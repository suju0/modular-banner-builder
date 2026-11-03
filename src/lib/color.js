/**
 * 컬러 변환 유틸
 *
 * 컬러 팔레트 UI(HEX / RGB / 스포이드)와 테마 오버라이드가 공유한다.
 */

/** "#abc" / "abc" / "#aabbcc" → "#AABBCC" (실패 시 null) */
export function normalizeHex(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
  return `#${[r, g, b]
    .map((v) => clamp(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** "지정 안 함"을 뜻하는 센티넬 — CSS 값으로도 그대로 쓸 수 있다 */
export const TRANSPARENT = "transparent";

export function isTransparent(value) {
  return !value || value === TRANSPARENT;
}

/** HEX + 불투명도 → rgba() 문자열. 색이 없으면(미지정) 완전 투명 */
export function withAlpha(hex, alpha = 1) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(0,0,0,0)";
  const a = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${+a.toFixed(3)})`;
}

/** HEX → HSV (인라인 컬러 피커의 핸들 위치 계산용) */
export function hexToHsv(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

/** HSV → HEX */
export function hsvToHex({ h, s, v }) {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const val = Math.max(0, Math.min(100, v)) / 100;
  const c = val * sat;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = val - c;

  const table = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[Math.floor(hh) % 6];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/** 배경색 위에서 읽히는 글자색(흑/백) — 스와치 라벨 대비용 */
export function readableTextOn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#111827"; // 투명/파싱 실패 — 밝은 배경 가정
  // WCAG 상대 휘도
  const channel = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  return luminance > 0.45 ? "#111827" : "#FFFFFF";
}

/** 스포이드(EyeDropper API) 지원 여부 — Chrome/Edge 계열만 지원 */
export function supportsEyeDropper() {
  return typeof window !== "undefined" && typeof window.EyeDropper === "function";
}

/** 화면에서 색을 집어온다. 취소하면 null */
export async function pickScreenColor() {
  if (!supportsEyeDropper()) throw new Error("이 브라우저는 스포이드를 지원하지 않습니다.");
  try {
    const result = await new window.EyeDropper().open();
    return normalizeHex(result.sRGBHex);
  } catch {
    return null; // 사용자가 Esc 로 취소
  }
}
