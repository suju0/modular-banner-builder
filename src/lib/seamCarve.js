/**
 * 내용 인식 비율 (Content-Aware Scale) — 심 카빙
 *
 * 에너지(밝기 그라디언트)가 가장 낮은 이음선(seam)을 찾아 복제하거나 제거해서
 * 피사체는 그대로 두고 여백만 늘리거나 줄인다. 상품컷을 배너 비율에 맞출 때
 * 단순 늘리기(왜곡)나 크롭(잘림) 대신 쓴다.
 *
 * 성능 설계: **심 탐색은 저해상도, 적용은 원본 해상도.**
 * 비용이 (픽셀 수 × 심 개수)로 늘어나 원본 해상도에서 수백 개를 돌리면 브라우저가
 * 수십 초 멈춘다. 어느 열을 늘릴지는 축소본에서 판단해도 결과가 사실상 같으므로,
 * 저해상도에서 계산한 "열별 복제/제거 횟수"를 원본 해상도로 확대 적용한다.
 */

import { createCanvas, loadImage } from "./imageUtils";

/** 심 탐색 작업 해상도 (긴 변) */
const WORK_MAX = 560;
/** 한 번에 처리할 심 개수 상한 — 체감 대기를 몇 초 내로 묶는다 */
const MAX_SEAMS = 220;
/** 한 번에 늘릴 수 있는 최대 배율 */
export const MAX_CARVE_RATIO = 1.6;
/**
 * 피사체 보호 가중치.
 *
 * 그라디언트만 에너지로 쓰면 **단색 피사체의 내부가 에너지 0** 이어서 심이 상품을
 * 관통해 지나간다(윤곽만 비싸고 속은 공짜). 실제로 테스트 이미지의 원/타원이
 * 가로로 찢겼다. 그래서 "테두리에서 추정한 배경색과 다른 픽셀"에 비용을 더해
 * 배경이 아닌 영역 전체를 비싸게 만든다. 상품컷(단색·그라데이션 배경)에 잘 맞는다.
 */
const PROTECT_WEIGHT = 900;
/** 배경으로 간주할 색 거리 임계값 */
const BG_TOLERANCE = 26;

/**
 * @param {string} dataUrl
 * @param {{targetRatio:number, onProgress?:Function}} opts targetRatio = 목표 가로/세로 비
 * @returns {Promise<{dataUrl:string, w:number, h:number, changed:number, warning?:string}>}
 */
export async function contentAwareScale(dataUrl, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const targetRatio = opts.targetRatio;
  if (!targetRatio || !Number.isFinite(targetRatio)) {
    throw new Error("목표 비율이 올바르지 않습니다.");
  }

  onProgress({ ratio: 0.05, label: "이미지 분석 중" });

  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const full = createCanvas(W, H);
  const fullCtx = full.getContext("2d");
  fullCtx.drawImage(img, 0, 0);
  const fullPx = fullCtx.getImageData(0, 0, W, H).data;

  // 작업 해상도 사본
  const shrink = Math.min(1, WORK_MAX / Math.max(W, H));
  const w0 = Math.max(8, Math.round(W * shrink));
  const h0 = Math.max(8, Math.round(H * shrink));
  const work = createCanvas(w0, h0);
  const workCtx = work.getContext("2d");
  workCtx.imageSmoothingQuality = "high";
  workCtx.drawImage(img, 0, 0, w0, h0);
  const workPx = workCtx.getImageData(0, 0, w0, h0).data;

  // 목표 폭(작업 해상도 기준) → 심 개수
  const rawDelta = Math.round(h0 * targetRatio - w0);
  const limit = Math.min(MAX_SEAMS, Math.round(w0 * (MAX_CARVE_RATIO - 1)));
  const delta = Math.max(-Math.round(w0 * 0.4), Math.min(limit, rawDelta));
  const clamped = delta !== rawDelta;

  if (Math.abs(delta) < 2) {
    return { dataUrl, w: W, h: H, changed: 0 };
  }

  // 테두리에서 배경색을 추정해 "피사체 보호맵"을 만든다
  const protect = buildProtectMap(workPx, w0, h0);
  const { marks, applied } = await computeSeamMarks(
    workPx,
    w0,
    h0,
    Math.abs(delta),
    protect,
    onProgress,
  );

  if (applied === 0) {
    return {
      dataUrl,
      w: W,
      h: H,
      changed: 0,
      warning: "늘릴 여백이 없습니다. 배경 확장을 먼저 적용해 보세요.",
    };
  }

  // 행마다 삽입 수가 달라지면 물체 경계가 행 단위로 어긋나 들쭉날쭉해진다.
  // 누적 변위를 세로로 평활화해 경계가 매끄럽게 밀리도록 만든다.
  smoothMarksVertically(marks, w0, h0, 6);

  onProgress({ ratio: 0.9, label: "원본 해상도에 적용 중" });
  const result =
    delta > 0
      ? applyDuplication(fullPx, W, H, marks, w0, h0)
      : applyRemoval(fullPx, W, H, marks, w0, h0);

  const out = createCanvas(result.w, H);
  out.getContext("2d").putImageData(new ImageData(result.px, result.w, H), 0, 0);

  onProgress({ ratio: 1, label: "완료" });
  return {
    dataUrl: out.toDataURL("image/png"),
    w: result.w,
    h: H,
    changed: delta > 0 ? applied : -applied,
    warning:
      clamped || applied < Math.abs(delta)
        ? `피사체를 지키는 범위까지만 조정했습니다 (현재 ${(result.w / H).toFixed(2)}:1). 더 넓히려면 배경 확장을 함께 쓰세요.`
        : undefined,
  };
}

/**
 * 작업 해상도에서 심을 count 개 찾아, 원본 열 기준 복제/제거 횟수를 기록한다.
 *
 * 성능: 버퍼를 미리 잡아 재사용하고 심 제거를 in-place 로 처리한다.
 * (심마다 배열을 새로 만들면 GC 때문에 수백 개 처리에서 10초 이상 걸린다)
 *
 * @returns {Uint16Array} marks[y * w0 + x]
 */
async function computeSeamMarks(source, w0, h0, count, protect, onProgress) {
  const marks = new Uint16Array(w0 * h0);

  // 행 시작 위치는 항상 y * w0 (stride 고정). 유효 폭만 width 로 줄여 나간다.
  const px = source.slice();
  const indices = new Int32Array(w0 * h0);
  for (let y = 0; y < h0; y++) {
    for (let x = 0; x < w0; x++) indices[y * w0 + x] = x;
  }

  const gray = new Float32Array(w0 * h0);
  const energy = new Float32Array(w0 * h0);
  const cost = new Float32Array(w0 * h0);
  const from = new Int8Array(w0 * h0);
  const seam = new Int32Array(h0);

  let width = w0;
  const total = Math.max(1, Math.min(count, w0 - 4));
  /**
   * 배경 여유가 다하면 심이 피사체를 관통하기 시작한다(테두리가 찢어짐).
   * 심의 누적 비용이 이 한계를 넘으면 더 이상 늘리지 않고 멈춘다.
   * 배경만 지나는 심은 비용이 h0 × 그라디언트(수 단위)라 여유가 크다.
   */
  const maxSeamCost = h0 * (PROTECT_WEIGHT * 0.02 + 120);
  let applied = 0;

  for (let i = 0; i < total; i++) {
    computeEnergy(px, w0, width, h0, gray, energy, protect, indices);
    const seamCost = findVerticalSeam(energy, w0, width, h0, cost, from, seam);
    if (seamCost > maxSeamCost) break;

    for (let y = 0; y < h0; y++) {
      marks[y * w0 + indices[y * w0 + seam[y]]] += 1;
    }
    applied++;

    removeSeamInPlace(px, indices, w0, width, h0, seam);
    width -= 1;

    if (i % 40 === 0) {
      onProgress({ ratio: 0.1 + (i / total) * 0.75, label: `이음선 계산 ${i}/${total}` });
      // UI 진행률 갱신을 위해 이벤트 루프를 양보 (자주 하면 오히려 느려진다)
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return { marks, applied };
}

/**
 * 에너지 = 밝기 그라디언트 + 피사체 보호항
 *
 * 보호맵은 원본 좌표 기준이므로 indices 로 현재 열 → 원본 열을 되짚어 읽는다.
 */
function computeEnergy(px, stride, width, h, gray, energy, protect, indices) {
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const p = (row + x) * 4;
      gray[row + x] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
    }
  }

  for (let y = 0; y < h; y++) {
    const row = y * stride;
    const up = Math.max(0, y - 1) * stride;
    const down = Math.min(h - 1, y + 1) * stride;
    for (let x = 0; x < width; x++) {
      const left = gray[row + Math.max(0, x - 1)];
      const right = gray[row + Math.min(width - 1, x + 1)];
      const grad = Math.abs(right - left) + Math.abs(gray[down + x] - gray[up + x]);
      energy[row + x] = grad + (protect ? protect[row + indices[row + x]] : 0);
    }
  }
}

/**
 * 테두리 픽셀 중앙값으로 배경색을 추정하고, 그 색과 다른 픽셀에 비용을 매긴다.
 * @returns {Float32Array} protect[y * w + x]
 */
function buildProtectMap(px, w, h) {
  const rs = [];
  const gs = [];
  const bs = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 48));
  const sample = (x, y) => {
    const p = (y * w + x) * 4;
    if (px[p + 3] === 0) return; // 투명(누끼)은 배경으로 취급
    rs.push(px[p]);
    gs.push(px[p + 1]);
    bs.push(px[p + 2]);
  };
  for (let x = 0; x < w; x += step) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    sample(0, y);
    sample(w - 1, y);
  }

  const median = (arr) => {
    if (!arr.length) return 255;
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const bg = { r: median(rs), g: median(gs), b: median(bs) };

  const raw = new Float32Array(w * h);
  for (let i = 0, p = 0; i < raw.length; i++, p += 4) {
    if (px[p + 3] === 0) continue;
    const dr = px[p] - bg.r;
    const dg = px[p + 1] - bg.g;
    const db = px[p + 2] - bg.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist > BG_TOLERANCE) {
      raw[i] = PROTECT_WEIGHT * Math.min(1, (dist - BG_TOLERANCE) / 60);
    }
  }

  // 가로 방향으로 살짝 팽창(dilate)시켜 심이 피사체 윤곽에 붙어 지나가지 못하게 한다.
  // (윤곽을 스치는 심은 경계 픽셀을 복제해 테두리가 지저분해진다)
  const DILATE = 3;
  const protect = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let max = 0;
      const from = Math.max(0, x - DILATE);
      const to = Math.min(w - 1, x + DILATE);
      for (let k = from; k <= to; k++) {
        if (raw[row + k] > max) max = raw[row + k];
      }
      protect[row + x] = max;
    }
  }
  return protect;
}

/** 누적 최소 에너지 DP → 최소 심 (각 행의 x 좌표를 seam 에 채운다) */
function findVerticalSeam(energy, stride, width, h, cost, from, seam) {
  for (let x = 0; x < width; x++) cost[x] = energy[x];

  for (let y = 1; y < h; y++) {
    const row = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < width; x++) {
      let best = cost[prev + x];
      let dir = 0;
      if (x > 0 && cost[prev + x - 1] < best) {
        best = cost[prev + x - 1];
        dir = -1;
      }
      if (x < width - 1 && cost[prev + x + 1] < best) {
        best = cost[prev + x + 1];
        dir = 1;
      }
      cost[row + x] = energy[row + x] + best;
      from[row + x] = dir;
    }
  }

  const last = (h - 1) * stride;
  let minX = 0;
  for (let x = 1; x < width; x++) {
    if (cost[last + x] < cost[last + minX]) minX = x;
  }

  let x = minX;
  for (let y = h - 1; y >= 0; y--) {
    seam[y] = x;
    x = Math.min(width - 1, Math.max(0, x + from[y * stride + x]));
  }

  return cost[last + minX];
}

/** 심 제거 — 각 행의 뒷부분을 한 칸 왼쪽으로 당긴다 (할당 없음) */
function removeSeamInPlace(px, indices, stride, width, h, seam) {
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    for (let x = seam[y]; x < width - 1; x++) {
      const d = (row + x) * 4;
      const s = (row + x + 1) * 4;
      px[d] = px[s];
      px[d + 1] = px[s + 1];
      px[d + 2] = px[s + 2];
      px[d + 3] = px[s + 3];
      indices[row + x] = indices[row + x + 1];
    }
  }
}

/**
 * 삽입/제거 변위 평활화.
 *
 * marks 를 행별 누적합(= 그 열까지의 변위)으로 바꿔 세로로 평균한 뒤 되돌린다.
 * 누적합은 x 에 대해 단조증가라 평균 후에도 단조성이 유지되므로,
 * 차분을 다시 취하면 음수 없이 부드러운 변위 분포가 나온다.
 */
function smoothMarksVertically(marks, w, h, radius) {
  const prefix = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let run = 0;
    for (let x = 0; x < w; x++) {
      run += marks[row + x];
      prefix[row + x] = run;
    }
  }

  const smoothed = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let n = 0;
      const from = Math.max(0, y - radius);
      const to = Math.min(h - 1, y + radius);
      for (let k = from; k <= to; k++) {
        sum += prefix[k * w + x];
        n++;
      }
      smoothed[y * w + x] = sum / n;
    }
  }

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let prev = 0;
    for (let x = 0; x < w; x++) {
      const cur = Math.round(smoothed[row + x]);
      marks[row + x] = Math.max(0, cur - prev);
      prev = cur;
    }
  }
}

/** 원본 좌표 → 작업 좌표 매핑 */
function mapper(fullSize, workSize) {
  const ratio = workSize / fullSize;
  return (v) => Math.min(workSize - 1, Math.floor(v * ratio));
}

/** 기록한 열을 원본 해상도에서 복제 (폭 증가) */
function applyDuplication(fullPx, W, H, marks, w0, h0) {
  const mapX = mapper(W, w0);
  const mapY = mapper(H, h0);

  // 행마다 삽입 수가 몇 픽셀 다를 수 있어 최대값으로 폭을 맞춘다
  let outW = 0;
  for (let y = 0; y < H; y++) {
    const yw = mapY(y) * w0;
    let width = 0;
    for (let x = 0; x < W; x++) width += 1 + marks[yw + mapX(x)];
    if (width > outW) outW = width;
  }

  const out = new Uint8ClampedArray(outW * H * 4);
  for (let y = 0; y < H; y++) {
    const yw = mapY(y) * w0;
    let target = 0;
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4;
      const s2 = (y * W + Math.min(W - 1, x + 1)) * 4;
      const copies = 1 + marks[yw + mapX(x)];
      for (let c = 0; c < copies && target < outW; c++) {
        const d = (y * outW + target) * 4;
        // 복제 픽셀은 다음 열과 섞어 늘어난 부분이 띠처럼 보이지 않게 한다
        const t = copies === 1 ? 0 : c / copies;
        out[d] = fullPx[s] * (1 - t) + fullPx[s2] * t;
        out[d + 1] = fullPx[s + 1] * (1 - t) + fullPx[s2 + 1] * t;
        out[d + 2] = fullPx[s + 2] * (1 - t) + fullPx[s2 + 2] * t;
        out[d + 3] = fullPx[s + 3] * (1 - t) + fullPx[s2 + 3] * t;
        target++;
      }
    }
    // 짧은 행은 마지막 픽셀로 채운다 (최대 몇 px)
    const last = (y * outW + Math.max(0, target - 1)) * 4;
    while (target < outW) {
      const d = (y * outW + target) * 4;
      out[d] = out[last];
      out[d + 1] = out[last + 1];
      out[d + 2] = out[last + 2];
      out[d + 3] = out[last + 3];
      target++;
    }
  }

  return { px: out, w: outW };
}

/** 기록한 열을 원본 해상도에서 제거 (폭 감소) */
function applyRemoval(fullPx, W, H, marks, w0, h0) {
  const mapX = mapper(W, w0);
  const mapY = mapper(H, h0);

  let outW = Number.MAX_SAFE_INTEGER;
  for (let y = 0; y < H; y++) {
    const yw = mapY(y) * w0;
    let width = 0;
    for (let x = 0; x < W; x++) if (!marks[yw + mapX(x)]) width++;
    if (width < outW) outW = width;
  }
  outW = Math.max(1, outW);

  const out = new Uint8ClampedArray(outW * H * 4);
  for (let y = 0; y < H; y++) {
    const yw = mapY(y) * w0;
    let target = 0;
    for (let x = 0; x < W && target < outW; x++) {
      if (marks[yw + mapX(x)]) continue;
      const s = (y * W + x) * 4;
      const d = (y * outW + target) * 4;
      out[d] = fullPx[s];
      out[d + 1] = fullPx[s + 1];
      out[d + 2] = fullPx[s + 2];
      out[d + 3] = fullPx[s + 3];
      target++;
    }
  }

  return { px: out, w: outW };
}
