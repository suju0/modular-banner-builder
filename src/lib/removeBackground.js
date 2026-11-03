/**
 * 배경 제거(누끼) 서비스
 *
 * 프로바이더 교체형 구조. 어떤 환경에서도 최소 하나는 동작하도록
 * "영역 지정 누끼"를 기본값으로 두고, 키/엔드포인트가 설정되면 AI 누끼를 쓴다.
 *
 * - region   : 남길 영역을 직접 선택 (로컬)
 *              · 빠른 선택 마스크 → 마스크 밖 제거 (lib/quickSelect.js)
 *              · 사각형 → 밖은 전부 제거, 안쪽 단색 배경은 플러드필
 * - removebg : remove.bg API — 상용 품질 (VITE_REMOVEBG_API_KEY 필요)
 * - endpoint : 자체 호스팅 rembg / BiRefNet (VITE_BG_REMOVE_ENDPOINT 필요)
 * - imgly    : @imgly/background-removal 브라우저 AI (CDN 런타임 로드)
 *
 * 주의: imgly 프로바이더는 AGPL-3.0 라이선스다. 사내 도구라도 배포 형태에 따라
 * 소스 공개 의무가 생길 수 있으므로 기본값에서 제외했고, 번들에 포함하지 않고
 * CDN 런타임 로드로만 동작시킨다. 상업적 사용 전 법무 검토를 권장한다.
 */

import { createCanvas, loadImage, trimTransparent, dataUrlToBlob, blobToDataUrl } from "./imageUtils";

const env = import.meta.env ?? {};

export const REMOVEBG_API_KEY = env.VITE_REMOVEBG_API_KEY || "";
export const BG_REMOVE_ENDPOINT = env.VITE_BG_REMOVE_ENDPOINT || "";
const BG_REMOVE_FIELD = env.VITE_BG_REMOVE_FIELD || "file";
const IMGLY_MODULE_URL =
  env.VITE_IMGLY_MODULE_URL || "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

export const BG_PROVIDERS = [
  {
    id: "region",
    name: "영역 지정 누끼",
    desc: "빠른 선택 · 사각형 · 즉시 실행",
    available: () => true,
    hint: "남길 부분을 브러시로 칠하거나(빠른 선택) 사각형으로 지정하면 그 밖을 지웁니다.",
  },
  {
    id: "removebg",
    name: "remove.bg",
    desc: "상용 AI · 최고 품질",
    available: () => Boolean(REMOVEBG_API_KEY),
    hint: "VITE_REMOVEBG_API_KEY 를 .env 에 설정하세요.",
  },
  {
    id: "endpoint",
    name: "자체 서버",
    desc: "사내 rembg / BiRefNet",
    available: () => Boolean(BG_REMOVE_ENDPOINT),
    hint: "VITE_BG_REMOVE_ENDPOINT 를 .env 에 설정하세요.",
  },
  {
    id: "imgly",
    name: "브라우저 AI",
    desc: "CDN 모델 · 최초 실행 시 다운로드",
    available: () => true,
    hint: "AGPL-3.0 라이선스. 최초 1회 모델(약 40MB)을 내려받습니다.",
  },
];

/** 환경 설정에 따라 가장 좋은 프로바이더를 고른다 */
export function detectProvider() {
  if (REMOVEBG_API_KEY) return "removebg";
  if (BG_REMOVE_ENDPOINT) return "endpoint";
  return "region";
}

/**
 * @param {string} dataUrl 원본 이미지 dataURL
 * @param {{
 *   provider?: string,
 *   region?: {x:number,y:number,w:number,h:number} | null,  // 0~1 정규화 좌표
 *   mask?: string | null,  // 빠른 선택 마스크 dataURL (흰색 = 남김). 있으면 region 보다 우선
 *   trim?: boolean,
 *   onProgress?: Function,
 * }} opts
 * @returns {Promise<{dataUrl: string, provider: string, warning?: string}>}
 */
export async function removeBackground(dataUrl, opts = {}) {
  const provider = opts.provider || detectProvider();
  const onProgress = opts.onProgress || (() => {});

  onProgress({ ratio: 0.05, label: "이미지 분석 중" });

  let result;
  switch (provider) {
    case "removebg":
      result = await viaRemoveBg(dataUrl, onProgress);
      break;
    case "endpoint":
      result = await viaEndpoint(dataUrl, onProgress);
      break;
    case "imgly":
      result = await viaImgly(dataUrl, onProgress);
      break;
    case "region":
    default:
      result = opts.mask
        ? await viaMask(dataUrl, opts.mask, onProgress)
        : await viaRegionFill(dataUrl, opts.region || null, onProgress);
      break;
  }

  onProgress({ ratio: 0.92, label: "여백 정리 중" });

  let outDataUrl = result.dataUrl;
  if (opts.trim !== false) {
    const img = await loadImage(outDataUrl);
    const canvas = createCanvas(img.naturalWidth, img.naturalHeight);
    canvas.getContext("2d").drawImage(img, 0, 0);
    outDataUrl = trimTransparent(canvas).toDataURL("image/png");
  }

  onProgress({ ratio: 1, label: "완료" });
  return { dataUrl: outDataUrl, provider, warning: result.warning };
}

/* ------------------------------------------------------------------ */
/* region (빠른 선택): 마스크 밖 제거                                   */
/* ------------------------------------------------------------------ */

/**
 * 작업 해상도(최대 640px)에서 만든 마스크를 원본 크기로 부드럽게 확대해 알파에 곱한다.
 * 확대 보간이 경계를 1–2px 페더링해 주므로 계단 현상 없이 잘린다.
 */
async function viaMask(dataUrl, maskUrl, onProgress) {
  const [img, maskImg] = await Promise.all([loadImage(dataUrl), loadImage(maskUrl)]);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  onProgress({ ratio: 0.3, label: "선택 영역 적용 중" });
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  const maskCanvas = createCanvas(w, h);
  const mctx = maskCanvas.getContext("2d");
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = "high";
  mctx.drawImage(maskImg, 0, 0, w, h);
  const m = mctx.getImageData(0, 0, w, h).data;

  onProgress({ ratio: 0.7, label: "알파 채널 합성 중" });
  let kept = 0;
  for (let i = 3; i < px.length; i += 4) {
    px[i] = Math.round((px[i] * m[i]) / 255);
    kept += m[i] / 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const coverage = kept / (w * h);
  const warning =
    coverage < 0.01
      ? "남은 영역이 거의 없습니다. 남길 부분을 다시 칠해 주세요."
      : coverage > 0.985
        ? "이미지가 거의 그대로 남았습니다. 배경 쪽을 빼기로 덜어 내세요."
        : undefined;
  return { dataUrl: canvas.toDataURL("image/png"), warning };
}

/* ------------------------------------------------------------------ */
/* region: 영역 지정 + 단색 배경 플러드필                              */
/* ------------------------------------------------------------------ */

/**
 * 1) 선택 영역 밖은 전부 투명 처리 (경계 2px 페더링)
 * 2) 영역 안쪽에서 다시 테두리 플러드필 → 상품 주변에 남은 단색 배경 제거
 *
 * 허용 오차는 영역 테두리 픽셀의 산포도에서 자동 계산한다.
 * (사용자가 감으로 슬라이더를 맞추는 것보다 실패 확률이 낮다)
 */
async function viaRegionFill(dataUrl, region, onProgress) {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  // 영역(픽셀 좌표) — 지정이 없으면 전체 이미지
  const rect = region
    ? {
        x0: Math.max(0, Math.round(region.x * w)),
        y0: Math.max(0, Math.round(region.y * h)),
        x1: Math.min(w - 1, Math.round((region.x + region.w) * w) - 1),
        y1: Math.min(h - 1, Math.round((region.y + region.h) * h) - 1),
      }
    : { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };

  if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) {
    throw new Error("선택 영역이 너무 작습니다.");
  }

  let removed = 0;

  // 1) 영역 밖 제거
  //
  // 경계를 페더링(부분 알파)하지 않고 완전히 잘라낸다.
  // 페더링을 넣으면 선택 사각형 모양의 반투명 테두리가 남아,
  // 트리밍 후에도 상품 주변에 사각 여백이 생기고 슬롯에서 작게 배치된다.
  if (region) {
    onProgress({ ratio: 0.2, label: "선택 영역 밖 제거 중" });
    for (let y = 0; y < h; y++) {
      const insideRow = y >= rect.y0 && y <= rect.y1;
      for (let x = 0; x < w; x++) {
        if (insideRow && x >= rect.x0 && x <= rect.x1) continue;
        px[(y * w + x) * 4 + 3] = 0;
        removed++;
      }
    }
  }

  // 2) 영역 안쪽 단색 배경 플러드필
  onProgress({ ratio: 0.45, label: "배경색 추정 중" });
  const { color: bg, spread } = estimateRectBorderColor(px, w, rect);
  const hardTol = Math.min(55, Math.max(16, 14 + spread * 1.5));
  const softTol = hardTol * 1.9;

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1));
  let head = 0;
  let tail = 0;

  const push = (x, y) => {
    if (x < rect.x0 || x > rect.x1 || y < rect.y0 || y > rect.y1) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = rect.x0; x <= rect.x1; x++) {
    push(x, rect.y0);
    push(x, rect.y1);
  }
  for (let y = rect.y0; y <= rect.y1; y++) {
    push(rect.x0, y);
    push(rect.x1, y);
  }

  onProgress({ ratio: 0.6, label: "배경 영역 추적 중" });

  while (head < tail) {
    const idx = queue[head++];
    const p = idx * 4;
    if (px[p + 3] === 0) continue;

    const dist = colorDistance(px[p], px[p + 1], px[p + 2], bg);
    const x = idx % w;
    const y = (idx - x) / w;

    if (dist <= hardTol) {
      px[p + 3] = 0;
      removed++;
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
    } else if (dist <= softTol) {
      // 경계 픽셀 — 부분 투명 처리만 하고 확산은 멈춘다
      const ratio = (dist - hardTol) / (softTol - hardTol);
      px[p + 3] = Math.min(px[p + 3], Math.round(255 * ratio));
      removed += 1 - ratio;
    }
  }

  onProgress({ ratio: 0.8, label: "알파 채널 합성 중" });
  ctx.putImageData(imageData, 0, 0);

  const coverage = removed / (w * h);
  let warning;
  if (coverage < 0.02) {
    warning = "제거된 배경이 거의 없습니다. 남길 영역을 더 좁게 지정하거나 AI 누끼를 사용하세요.";
  } else if (coverage > 0.985) {
    warning = "이미지가 거의 전부 제거되었습니다. 남길 영역을 다시 지정해 주세요.";
  }

  return { dataUrl: canvas.toDataURL("image/png"), warning };
}

/**
 * 사각 영역 테두리 픽셀에서 배경색(중앙값)과 산포도(평균 절대편차)를 구한다.
 * 산포도가 크면 배경이 단색이 아니라는 뜻이므로 허용 오차를 키운다.
 */
function estimateRectBorderColor(px, w, rect) {
  const rs = [];
  const gs = [];
  const bs = [];
  const stepX = Math.max(1, Math.floor((rect.x1 - rect.x0) / 64));
  const stepY = Math.max(1, Math.floor((rect.y1 - rect.y0) / 64));

  const sample = (x, y) => {
    const p = (y * w + x) * 4;
    if (px[p + 3] === 0) return;
    rs.push(px[p]);
    gs.push(px[p + 1]);
    bs.push(px[p + 2]);
  };

  for (let x = rect.x0; x <= rect.x1; x += stepX) {
    sample(x, rect.y0);
    sample(x, rect.y1);
  }
  for (let y = rect.y0; y <= rect.y1; y += stepY) {
    sample(rect.x0, y);
    sample(rect.x1, y);
  }

  const color = { r: median(rs), g: median(gs), b: median(bs) };
  const spread =
    rs.length === 0
      ? 0
      : rs.reduce(
          (sum, _, i) =>
            sum + (Math.abs(rs[i] - color.r) + Math.abs(gs[i] - color.g) + Math.abs(bs[i] - color.b)) / 3,
          0,
        ) / rs.length;

  return { color, spread };
}

function median(arr) {
  if (arr.length === 0) return 255;
  const sorted = arr.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** 인지 가중 RGB 거리 (녹색 채널에 가중) */
function colorDistance(r, g, b, bg) {
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  return Math.sqrt(dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.9);
}

/* ------------------------------------------------------------------ */
/* removebg / endpoint / imgly                                        */
/* ------------------------------------------------------------------ */

async function viaRemoveBg(dataUrl, onProgress) {
  if (!REMOVEBG_API_KEY) {
    throw new Error("remove.bg API 키가 없습니다. .env 에 VITE_REMOVEBG_API_KEY 를 설정하세요.");
  }
  onProgress({ ratio: 0.3, label: "remove.bg 요청 중" });

  const blob = await dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append("image_file", blob, "upload.png");
  form.append("size", "auto");
  form.append("format", "png");

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": REMOVEBG_API_KEY },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`remove.bg 실패 (${res.status}) ${text.slice(0, 120)}`);
  }

  onProgress({ ratio: 0.75, label: "결과 수신 중" });
  return { dataUrl: await blobToDataUrl(await res.blob()) };
}

async function viaEndpoint(dataUrl, onProgress) {
  if (!BG_REMOVE_ENDPOINT) {
    throw new Error("자체 누끼 서버가 없습니다. .env 에 VITE_BG_REMOVE_ENDPOINT 를 설정하세요.");
  }
  onProgress({ ratio: 0.3, label: "누끼 서버 요청 중" });

  const blob = await dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append(BG_REMOVE_FIELD, blob, "upload.png");

  const res = await fetch(BG_REMOVE_ENDPOINT, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`누끼 서버 실패 (${res.status})`);
  }

  onProgress({ ratio: 0.75, label: "결과 수신 중" });
  return { dataUrl: await blobToDataUrl(await res.blob()) };
}

let imglyModulePromise = null;

async function viaImgly(dataUrl, onProgress) {
  onProgress({ ratio: 0.1, label: "AI 모듈 로드 중" });

  if (!imglyModulePromise) {
    // 번들에 포함시키지 않고 런타임에 CDN 에서 로드한다 (라이선스 격리 목적)
    imglyModulePromise = import(/* @vite-ignore */ IMGLY_MODULE_URL).catch((err) => {
      imglyModulePromise = null;
      throw new Error(`브라우저 AI 모듈 로드 실패: ${err.message}`);
    });
  }
  const mod = await imglyModulePromise;
  const run = mod.removeBackground || mod.default?.removeBackground;
  if (typeof run !== "function") throw new Error("브라우저 AI 모듈 형식이 예상과 다릅니다.");

  const blob = await dataUrlToBlob(dataUrl);
  const out = await run(blob, {
    progress: (key, current, total) => {
      const ratio = total ? current / total : 0;
      onProgress({
        ratio: 0.15 + ratio * 0.6,
        label: String(key).startsWith("fetch") ? "AI 모델 다운로드 중" : "AI 누끼 처리 중",
      });
    },
  });

  return { dataUrl: await blobToDataUrl(out) };
}
