/**
 * 배경 이미지 변형 모델 (포토샵 자유 변형과 동일한 감각)
 *
 * transform = { scale, x, y }
 * - scale 1 = 캔버스를 꽉 채우는 크기(cover fit). 누끼 이미지는 contain 기준.
 * - x, y   = 캔버스 크기에 대한 비율 이동값 (0.1 = 캔버스 너비의 10% 오른쪽으로)
 *
 * 비율 좌표를 쓰는 이유: 배너 사이즈를 바꿔도 구도가 유지된다.
 * (이전 crop 사각형 모델보다 핸들 리사이즈/휠 줌 계산이 단순하다)
 */

export const DEFAULT_TRANSFORM = { scale: 1, x: 0, y: 0 };

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 6;

export function clampTransform(transform) {
  const t = { ...DEFAULT_TRANSFORM, ...transform };
  return {
    scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale)),
    // 이미지를 캔버스 밖으로 완전히 빼내지는 못하게 여유를 둔다
    x: Math.min(2, Math.max(-2, t.x)),
    y: Math.min(2, Math.max(-2, t.y)),
  };
}

export function isTransformed(transform) {
  const t = clampTransform(transform);
  return Math.abs(t.scale - 1) > 0.005 || Math.abs(t.x) > 0.002 || Math.abs(t.y) > 0.002;
}

/** 표시할 소스(원본 또는 누끼)와 그 픽셀 크기 */
export function resolveImageSource(image) {
  if (!image?.src) return null;
  const useCutout = Boolean(image.useCutout && image.cutoutSrc);
  const size = useCutout ? image.cutoutSize : image.srcSize;
  return {
    src: useCutout ? image.cutoutSrc : image.src,
    w: size?.w || 1,
    h: size?.h || 1,
    isCutout: useCutout,
  };
}

/**
 * 변형값 → 캔버스 안에서의 실제 그리기 좌표
 *
 * @returns {{baseScale:number, drawW:number, drawH:number, left:number, top:number}}
 */
export function computeImageLayout({ transform, source, canvasW, canvasH, fit = "cover" }) {
  const t = clampTransform(transform);
  const baseScale =
    fit === "contain"
      ? Math.min(canvasW / source.w, canvasH / source.h)
      : Math.max(canvasW / source.w, canvasH / source.h);

  const drawW = source.w * baseScale * t.scale;
  const drawH = source.h * baseScale * t.scale;

  return {
    transform: t,
    baseScale,
    drawW,
    drawH,
    left: (canvasW - drawW) / 2 + t.x * canvasW,
    top: (canvasH - drawH) / 2 + t.y * canvasH,
  };
}

/** 캔버스 px 이동량 → 변형값 이동 */
export function panTransform(transform, dxPx, dyPx, canvasW, canvasH) {
  const t = clampTransform(transform);
  return clampTransform({ ...t, x: t.x + dxPx / canvasW, y: t.y + dyPx / canvasH });
}

/**
 * 지정한 캔버스 좌표를 고정점으로 삼아 확대/축소 (휠 줌)
 * 커서 밑 이미지 지점이 그대로 유지된다.
 */
export function zoomAt(transform, nextScale, pointX, pointY, layout, canvasW, canvasH) {
  const t = clampTransform(transform);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));

  // 커서 아래 이미지 지점의 상대 위치 (0~1)
  const u = (pointX - layout.left) / layout.drawW;
  const v = (pointY - layout.top) / layout.drawH;

  const drawW = (layout.drawW / t.scale) * scale;
  const drawH = (layout.drawH / t.scale) * scale;

  return clampTransform({
    scale,
    x: (pointX - u * drawW - (canvasW - drawW) / 2) / canvasW,
    y: (pointY - v * drawH - (canvasH - drawH) / 2) / canvasH,
  });
}

/**
 * 핸들 8개 정의 — 코너 4 + 엣지 중앙 4.
 * ax/ay 는 이미지 박스 안에서의 위치(0=시작, 0.5=중앙, 1=끝).
 */
export const HANDLES = [
  { id: "nw", ax: 0, ay: 0, cursor: "nwse-resize", axis: "both" },
  { id: "n", ax: 0.5, ay: 0, cursor: "ns-resize", axis: "y" },
  { id: "ne", ax: 1, ay: 0, cursor: "nesw-resize", axis: "both" },
  { id: "e", ax: 1, ay: 0.5, cursor: "ew-resize", axis: "x" },
  { id: "se", ax: 1, ay: 1, cursor: "nwse-resize", axis: "both" },
  { id: "s", ax: 0.5, ay: 1, cursor: "ns-resize", axis: "y" },
  { id: "sw", ax: 0, ay: 1, cursor: "nesw-resize", axis: "both" },
  { id: "w", ax: 0, ay: 0.5, cursor: "ew-resize", axis: "x" },
];

/**
 * 핸들 드래그 → 비율 유지 리사이즈. 반대쪽 코너(또는 엣지)를 고정점으로 잡는다.
 *
 * @param handle HANDLES 항목
 * @param dxPx,dyPx 캔버스 좌표계 이동량
 * @param layout 드래그 시작 시점의 computeImageLayout 결과
 */
export function resizeTransformByHandle(handle, dxPx, dyPx, layout, canvasW, canvasH) {
  const t = layout.transform;

  // 고정점 = 잡은 핸들의 반대편 지점
  const anchorAx = 1 - handle.ax;
  const anchorAy = 1 - handle.ay;
  const anchorX = layout.left + anchorAx * layout.drawW;
  const anchorY = layout.top + anchorAy * layout.drawH;

  // 잡은 핸들의 현재/이동 후 좌표
  const handleX = layout.left + handle.ax * layout.drawW;
  const handleY = layout.top + handle.ay * layout.drawH;

  const spanX = handleX - anchorX;
  const spanY = handleY - anchorY;

  let factor = 1;
  if (handle.axis === "x" || (handle.axis === "both" && Math.abs(dxPx) >= Math.abs(dyPx))) {
    if (Math.abs(spanX) < 1) return t;
    factor = (spanX + dxPx) / spanX;
  } else {
    if (Math.abs(spanY) < 1) return t;
    factor = (spanY + dyPx) / spanY;
  }

  // 뒤집힘 방지
  if (!Number.isFinite(factor) || factor <= 0.02) return t;

  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor));
  const drawW = (layout.drawW / t.scale) * scale;
  const drawH = (layout.drawH / t.scale) * scale;

  // 고정점이 제자리에 남도록 x/y 를 다시 계산
  return clampTransform({
    scale,
    x: (anchorX - anchorAx * drawW - (canvasW - drawW) / 2) / canvasW,
    y: (anchorY - anchorAy * drawH - (canvasH - drawH) / 2) / canvasH,
  });
}
