/**
 * 배경 그라데이션 — Figma Custom 패널과 같은 Stops 모델
 *
 * 사진 위에 얹어 텍스트 가독성을 확보하는 레이어다.
 *
 *   gradient = { enabled, type, angle, stops: [{ pos, color, opacity }] }
 *   - type    : "linear" | "radial" | "angular"
 *   - angle   : linear / angular 의 방향 (CSS deg — 90 = 왼쪽 → 오른쪽)
 *   - pos     : 0–100 (%)
 *   - color   : HEX, 또는 null = 테마 배경색을 따라감 (테마를 바꾸면 같이 바뀜)
 *   - opacity : 0–1
 *
 * 예전 저장 형태({ from, fromOpacity, to, toOpacity, midpoint })는
 * normalizeGradient() 가 같은 모양의 stops 로 바꿔 읽는다 (히스토리 복원 호환).
 */

import { hexToRgb, isTransparent, rgbToHex, withAlpha } from "./color";

/** 테마 배경까지 미지정일 때 그라데이션이 기준으로 삼는 색 */
export const GRADIENT_FALLBACK_COLOR = "#111111";

export const GRADIENT_TYPES = [
  { id: "linear", label: "Linear" },
  { id: "radial", label: "Radial" },
  { id: "angular", label: "Angular" },
];

/**
 * 기본값 — 처음에는 꺼 둔다 (켜면: 텍스트 쪽 0–45% 테마 배경 92%, 사진 쪽 100% 투명).
 * 켜진 채로 시작하면 사진을 올리자마자 브랜드 그린이 덮여 사진이 가려진 것처럼 보였다.
 */
export const DEFAULT_GRADIENT = {
  enabled: false,
  type: "linear",
  angle: 90,
  stops: [
    { pos: 0, color: null, opacity: 0.92 },
    { pos: 45, color: null, opacity: 0.92 },
    { pos: 100, color: null, opacity: 0 },
  ],
};

export const MIN_STOPS = 2;

/** 시작 색을 지정하지 않았을 때 기준색 — 테마 배경, 그것마저 투명이면 폴백 색 */
export function resolveGradientBase(theme) {
  return isTransparent(theme?.bg) ? GRADIENT_FALLBACK_COLOR : theme.bg;
}

/** 예전 형태 → stops 형태. 이미 stops 면 정렬만 해서 돌려준다 */
export function normalizeGradient(gradient) {
  const g = gradient || DEFAULT_GRADIENT;
  if (Array.isArray(g.stops)) {
    return {
      enabled: g.enabled !== false,
      type: g.type || "linear",
      angle: Number.isFinite(g.angle) ? g.angle : 90,
      stops: [...g.stops].sort((a, b) => a.pos - b.pos),
    };
  }
  const end = g.to
    ? { color: g.to, opacity: g.toOpacity ?? 0.15 }
    : { color: g.from || null, opacity: 0 };
  return {
    enabled: g.enabled !== false,
    type: "linear",
    angle: Number.isFinite(g.angle) ? g.angle : 90,
    stops: [
      { pos: 0, color: g.from || null, opacity: g.fromOpacity ?? 0.92 },
      { pos: Math.max(0, Math.min(100, g.midpoint ?? 45)), color: g.from || null, opacity: g.fromOpacity ?? 0.92 },
      { pos: 100, ...end },
    ],
  };
}

/** 스톱의 실제 색 (null 이면 테마 기준색) */
export function stopColor(stop, theme) {
  return stop.color || resolveGradientBase(theme);
}

/** 그라데이션이 실제로 화면에 영향을 주는지 */
export function isGradientVisible(gradient) {
  const g = normalizeGradient(gradient);
  return g.enabled && g.stops.some((s) => s.opacity > 0.01);
}

/** 스톱 목록 → CSS 색 지점 문자열 */
function stopList(stops, theme) {
  return stops
    .map((s) => `${withAlpha(stopColor(s, theme), s.opacity)} ${Math.max(0, Math.min(100, s.pos))}%`)
    .join(", ");
}

/**
 * CSS background 값. 프리뷰와 Export 가 같은 함수를 쓰므로 결과가 갈라지지 않는다.
 * 투명 쪽 끝도 "같은 색의 알파 0" 으로 만든다 (transparent 키워드는 일부 엔진에서 회색으로 페이드).
 *
 * @returns {string|null} 그릴 필요가 없으면 null
 */
export function resolveGradient(gradient, theme) {
  if (!isGradientVisible(gradient)) return null;
  const g = normalizeGradient(gradient);
  const list = stopList(g.stops, theme);
  if (g.type === "radial") return `radial-gradient(ellipse at center, ${list})`;
  if (g.type === "angular") return `conic-gradient(from ${g.angle}deg at 50% 50%, ${list})`;
  return `linear-gradient(${g.angle}deg, ${list})`;
}

/** 편집기의 가로 막대용 — 타입과 무관하게 왼쪽 → 오른쪽으로 스톱을 펼쳐 보여 준다 */
export function resolveGradientBar(gradient, theme) {
  const g = normalizeGradient(gradient);
  return `linear-gradient(90deg, ${stopList(g.stops, theme)})`;
}

/** pos 지점의 색·불투명도 — 막대를 눌러 스톱을 추가할 때 그 자리 색을 그대로 쓴다 */
export function sampleGradient(gradient, theme, pos) {
  const { stops } = normalizeGradient(gradient);
  const after = stops.findIndex((s) => s.pos >= pos);
  if (after <= 0) {
    const s = stops[after === 0 ? 0 : stops.length - 1];
    return { color: stopColor(s, theme), opacity: s.opacity };
  }
  const a = stops[after - 1];
  const b = stops[after];
  const t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
  const ca = hexToRgb(stopColor(a, theme)) || { r: 0, g: 0, b: 0 };
  const cb = hexToRgb(stopColor(b, theme)) || { r: 0, g: 0, b: 0 };
  const mix = (x, y) => Math.round(x + (y - x) * t);
  return {
    color: rgbToHex({ r: mix(ca.r, cb.r), g: mix(ca.g, cb.g), b: mix(ca.b, cb.b) }),
    opacity: +(a.opacity + (b.opacity - a.opacity) * t).toFixed(2),
  };
}
