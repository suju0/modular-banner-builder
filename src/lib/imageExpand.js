/**
 * 배경 확장 · 내용 인식 비율
 *
 * 배너에서 텍스트가 놓일 자리에 "빈 배경"이 필요할 때 쓰는 두 가지 도구.
 *
 * 1) expandBackground  — 캔버스를 원하는 방향으로 늘리고 늘어난 영역을 채운다
 *                        (포토샵의 Crop + Generative Expand 에 대응)
 * 2) 내용 인식 비율(심 카빙)은 알고리즘 성격이 달라 lib/seamCarve.js 로 분리했다.
 *
 * ⚠ 확장 영역 채우기의 기본 방식은 **AI 생성이 아니라 엣지/미러 기반 합성**이다.
 *   진짜 생성형(디퓨전) 아웃페인팅은 모델 추론이 필요해 브라우저만으로는 불가능하다.
 *   사내 추론 서버(SD/Flux 계열 outpaint 엔드포인트)를 붙일 수 있게 프로바이더를
 *   분리해 두었다 — VITE_OUTPAINT_ENDPOINT 설정 시 자동으로 선택된다.
 *   스튜디오 상품컷(단색·소프트 그라데이션 배경)에서는 엣지 방식만으로도
 *   생성형과 구분되지 않는 결과가 나온다.
 */

import { createCanvas, dataUrlToBlob, blobToDataUrl, loadImage } from "./imageUtils";

const env = import.meta.env ?? {};
export const OUTPAINT_ENDPOINT = env.VITE_OUTPAINT_ENDPOINT || "";
const OUTPAINT_FIELD = env.VITE_OUTPAINT_FIELD || "image";

export const EXPAND_METHODS = [
  {
    id: "edge",
    name: "엣지 늘리기",
    desc: "가장자리 색을 늘림 · 단색/그라데이션 배경",
    available: () => true,
    hint: "스튜디오 상품컷처럼 배경이 단순할 때 가장 자연스럽습니다.",
  },
  {
    id: "mirror",
    name: "미러 + 블러",
    desc: "가장자리를 반사 후 흐림 · 질감 배경",
    available: () => true,
    hint: "나무결·패브릭처럼 질감이 있는 배경에 적합합니다.",
  },
  {
    id: "endpoint",
    name: "AI 아웃페인팅",
    desc: "사내 생성 모델 서버",
    available: () => Boolean(OUTPAINT_ENDPOINT),
    hint: "VITE_OUTPAINT_ENDPOINT 를 .env 에 설정하면 활성화됩니다.",
  },
];

export function detectExpandMethod() {
  return OUTPAINT_ENDPOINT ? "endpoint" : "edge";
}

export const EXPAND_DIRECTIONS = [
  { id: "right", label: "우측" },
  { id: "left", label: "좌측" },
  { id: "top", label: "상단" },
  { id: "bottom", label: "하단" },
];

/**
 * 캔버스를 늘리고 늘어난 영역을 채운다.
 *
 * @param {string} dataUrl
 * @param {{
 *   margins: {left?:number,right?:number,top?:number,bottom?:number}, // 원본 크기에 대한 비율
 *   method?: string,
 *   feather?: number,
 *   onProgress?: Function,
 * }} opts
 * @returns {Promise<{dataUrl:string, w:number, h:number, method:string, warning?:string}>}
 */
export async function expandBackground(dataUrl, opts = {}) {
  const method = opts.method || detectExpandMethod();
  const onProgress = opts.onProgress || (() => {});
  const m = {
    left: Math.max(0, opts.margins?.left || 0),
    right: Math.max(0, opts.margins?.right || 0),
    top: Math.max(0, opts.margins?.top || 0),
    bottom: Math.max(0, opts.margins?.bottom || 0),
  };
  if (!m.left && !m.right && !m.top && !m.bottom) {
    throw new Error("확장할 방향과 크기를 지정해 주세요.");
  }

  onProgress({ ratio: 0.1, label: "캔버스 확장 중" });

  const img = await loadImage(dataUrl);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const padL = Math.round(sw * m.left);
  const padR = Math.round(sw * m.right);
  const padT = Math.round(sh * m.top);
  const padB = Math.round(sh * m.bottom);

  const canvas = createCanvas(sw + padL + padR, sh + padT + padB);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, padL, padT);

  if (method === "endpoint") {
    onProgress({ ratio: 0.35, label: "AI 아웃페인팅 요청 중" });
    const filled = await viaOutpaintEndpoint(canvas, { padL, padR, padT, padB, sw, sh }, onProgress);
    return { dataUrl: filled, w: canvas.width, h: canvas.height, method };
  }

  onProgress({ ratio: 0.45, label: "확장 영역 채우는 중" });

  // 좌우를 먼저 채우고, 상하를 캔버스 전체 폭으로 채우면 코너가 자동으로 메워진다
  fillHorizontal(ctx, canvas, { padL, padR, padT, sw, sh, method });
  fillVertical(ctx, canvas, { padT, padB, method });

  onProgress({ ratio: 0.8, label: "이음선 정리 중" });
  featherSeams(ctx, canvas, { padL, padR, padT, padB, sw, sh, feather: opts.feather ?? 1 });

  const out = canvas.toDataURL("image/png");
  onProgress({ ratio: 1, label: "완료" });

  return {
    dataUrl: out,
    w: canvas.width,
    h: canvas.height,
    method,
    warning:
      method === "edge" && (m.left > 0.6 || m.right > 0.6 || m.top > 0.6 || m.bottom > 0.6)
        ? "확장 폭이 큽니다. 배경에 질감이 있으면 늘어난 자국이 보일 수 있습니다."
        : undefined,
  };
}

/** 좌·우 확장 영역 채우기 */
function fillHorizontal(ctx, canvas, { padL, padR, padT, sw, sh, method }) {
  const strip = Math.max(2, Math.round(sw * 0.02));

  if (padL > 0) {
    if (method === "mirror") {
      ctx.save();
      ctx.translate(padL, 0);
      ctx.scale(-1, 1);
      // 원본 좌측 strip 을 반사해서 채운다 (필요하면 반복)
      for (let x = 0; x < padL; x += strip) {
        ctx.drawImage(canvas, padL, padT, strip, sh, x, padT, strip, sh);
      }
      ctx.restore();
    }
    // 엣지 늘리기 (미러 위에도 한 번 더 얇게 덮어 이음선을 지운다)
    ctx.drawImage(canvas, padL, padT, 1, sh, 0, padT, method === "mirror" ? 2 : padL, sh);
  }

  if (padR > 0) {
    const rightEdge = padL + sw - 1;
    if (method === "mirror") {
      for (let x = 0; x < padR; x += strip) {
        ctx.save();
        ctx.translate(padL + sw + x + strip, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(canvas, padL + sw - strip, padT, strip, sh, 0, padT, strip, sh);
        ctx.restore();
      }
    }
    ctx.drawImage(
      canvas,
      rightEdge,
      padT,
      1,
      sh,
      padL + sw,
      padT,
      method === "mirror" ? 2 : padR,
      sh,
    );
  }
}

/** 상·하 확장 영역 채우기 (캔버스 전체 폭 사용 → 코너까지 메워진다) */
function fillVertical(ctx, canvas, { padT, padB, method }) {
  const full = canvas.width;
  const contentTop = padT;
  const contentBottom = canvas.height - padB;
  const strip = Math.max(2, Math.round((contentBottom - contentTop) * 0.02));

  if (padT > 0) {
    if (method === "mirror") {
      for (let y = 0; y < padT; y += strip) {
        ctx.save();
        ctx.translate(0, padT - y);
        ctx.scale(1, -1);
        ctx.drawImage(canvas, 0, contentTop, full, strip, 0, 0, full, strip);
        ctx.restore();
      }
    }
    ctx.drawImage(canvas, 0, contentTop, full, 1, 0, 0, full, method === "mirror" ? 2 : padT);
  }

  if (padB > 0) {
    if (method === "mirror") {
      for (let y = 0; y < padB; y += strip) {
        ctx.save();
        ctx.translate(0, contentBottom + y + strip);
        ctx.scale(1, -1);
        ctx.drawImage(canvas, 0, contentBottom - strip, full, strip, 0, 0, full, strip);
        ctx.restore();
      }
    }
    ctx.drawImage(
      canvas,
      0,
      contentBottom - 1,
      full,
      1,
      0,
      contentBottom,
      full,
      method === "mirror" ? 2 : padB,
    );
  }
}

/**
 * 원본과 확장 영역의 경계를 살짝 흐려 이음선을 지운다.
 * ctx.filter 를 지원하지 않는 브라우저에서는 건너뛴다 (결과는 약간 딱딱해짐).
 */
function featherSeams(ctx, canvas, { padL, padR, padT, padB, sw, sh, feather }) {
  if (!feather || typeof ctx.filter === "undefined") return;

  const blurPx = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) * 0.004 * feather));
  const band = blurPx * 6;

  const blurBand = (x, y, w, h) => {
    if (w <= 0 || h <= 0) return;
    const temp = createCanvas(w, h);
    temp.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(temp, x, y);
    ctx.restore();
  };

  if (padL > 0) blurBand(Math.max(0, padL - band / 2), padT, band, sh);
  if (padR > 0) blurBand(padL + sw - band / 2, padT, band, sh);
  if (padT > 0) blurBand(0, Math.max(0, padT - band / 2), canvas.width, band);
  if (padB > 0) blurBand(0, padT + sh - band / 2, canvas.width, band);
}

/** 사내 아웃페인팅 서버 — 확장 영역 마스크를 함께 보낸다 */
async function viaOutpaintEndpoint(canvas, { padL, padR, padT, padB, sw, sh }, onProgress) {
  const mask = createCanvas(canvas.width, canvas.height);
  const mctx = mask.getContext("2d");
  // 흰색 = 생성할 영역, 검정 = 보존할 영역 (일반적인 inpaint 마스크 규약)
  mctx.fillStyle = "#FFFFFF";
  mctx.fillRect(0, 0, mask.width, mask.height);
  mctx.fillStyle = "#000000";
  mctx.fillRect(padL, padT, sw, sh);

  const form = new FormData();
  form.append(OUTPAINT_FIELD, await dataUrlToBlob(canvas.toDataURL("image/png")), "image.png");
  form.append("mask", await dataUrlToBlob(mask.toDataURL("image/png")), "mask.png");
  form.append("pad", JSON.stringify({ left: padL, right: padR, top: padT, bottom: padB }));

  const res = await fetch(OUTPAINT_ENDPOINT, { method: "POST", body: form });
  if (!res.ok) throw new Error(`아웃페인팅 서버 실패 (${res.status})`);

  onProgress({ ratio: 0.85, label: "결과 수신 중" });
  return blobToDataUrl(await res.blob());
}
