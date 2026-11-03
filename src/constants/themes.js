/**
 * 컬러 테마 팔레트
 *
 * 테마는 "출발점"일 뿐이고 최종 색은 역할별 오버라이드가 결정한다(resolveTheme).
 * 역할별 지정이 가능해진 뒤로 프리셋을 여러 개 둘 이유가 줄어서
 * 브랜드 기본값 하나만 남겼다. 배경 미지정(투명)은 오버라이드로 처리한다.
 */

export const THEMES = [
  {
    id: "purple",
    name: "퍼플 브랜드",
    bg: "#5F0080",
    text: "#FFFFFF",
    accent: "#FFD43B",
    sub: "#E0C3FC",
    badge: "#FFD43B",
    badgeText: "#5F0080",
    cta: "#8B3DD9",
    ctaText: "#FFFFFF",
  },
];

/**
 * 색을 직접 지정할 수 있는 역할 목록.
 * 사이드바 컬러 팔레트 UI 가 이 순서대로 스와치를 렌더한다.
 */
export const COLOR_ROLES = [
  { key: "bg", label: "배경", desc: "배너 바탕색 (지정 안 하면 투명)", allowNone: true },
  { key: "text", label: "타이틀", desc: "메인 타이틀 텍스트" },
  { key: "sub", label: "서브 텍스트", desc: "서브 카피 · 기간" },
  { key: "accent", label: "강조", desc: "할인 뱃지 텍스트" },
  { key: "badge", label: "태그 배경", desc: "이벤트 태그 바탕" },
  { key: "badgeText", label: "태그 글자", desc: "이벤트 태그 텍스트" },
  { key: "cta", label: "CTA 배경", desc: "CTA 버튼 · 바 바탕" },
  { key: "ctaText", label: "CTA 텍스트", desc: "CTA 버튼 · 바 텍스트" },
];

/**
 * 테마 + 사용자 오버라이드를 합쳐 실제 렌더에 쓸 색 세트를 만든다.
 * 프리뷰와 Export 가 동일한 결과를 얻으려면 반드시 이 함수를 거쳐야 한다.
 */
export function resolveTheme(themeId, overrides) {
  const base = THEMES.find((t) => t.id === themeId) || THEMES[0];
  if (!overrides) return base;

  const merged = { ...base };
  for (const { key } of COLOR_ROLES) {
    if (overrides[key]) merged[key] = overrides[key];
  }
  return merged;
}
