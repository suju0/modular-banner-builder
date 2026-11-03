/**
 * 레이아웃 템플릿 정의
 *
 * 레이아웃이 정의하는 것은 **텍스트의 수직 구성 + 프레임 형태**뿐이다.
 * 이미지는 어떤 레이아웃에서든 배경으로 합성되고(이미지 슬롯 개념 없음),
 * 수평 배치/정렬은 사용자 설정이다 (resolveSlotBox 가 둘을 합친다).
 *
 * - channel        : "web" | "app" — 지면 분류
 * - recommendedSize: 이 형태의 표준 규격 id (선택 시 자동 적용, 사이즈 칩에 "권장" 표시)
 * - block.w        : 텍스트 블록 폭 (%) — 모든 모듈이 공유해 정렬선이 맞는다
 * - block.position / block.align : 이 템플릿의 기본 배치/정렬
 * - frame.radius   : "none" | "top" | "all" — 팝업/시트의 라운드 코너
 * - cta            : { style: "bar" | "button" } — CTA 표현 방식
 * - indicator      : "bottom" | null — 캐러셀 인디케이터 (앱 홈 메인 배너만 해당, 미리보기 전용)
 *
 * y 값은 **라인박스 top** 이다. Figma 는 글자 잉크 기준이라 그대로 옮기면 안 되고,
 * (반 줄간격 + 폰트 어센트 − 잉크 어센트) 만큼 위로 올려 잡아야 한다.
 * 앱 홈 메인은 그 역산 결과를 그대로 넣었다 — app-hero 슬롯 주석 참고.
 * 두 줄 타이틀(86px × 1.17 × 2 ≈ 24% of 840)을 기준으로 아래 모듈과의 간격을 확보했다.
 */

/**
 * 텍스트 크기 비율 — **Figma 원본(앱 홈 메인 1125×840) 실측 기준**.
 * 기준값 = min(높이, 너비 × 0.55) = 618.75 에 곱한다 (SlotRenderer 참고).
 *
 *   타이틀 86px (86/618.75 = 0.139)
 *   서브카피 42px (0.0679)
 *   기간 38px (0.0614)
 *
 * titleLead(타이틀 윗줄)는 타이틀과 **같은 크기**이고 두께만 가볍다
 * — "컬리와 함께하는(Regular) / 9월의 결제 혜택(Medium)" 구성.
 */
export const TYPE_RATIO = {
  eventTag: 0.055,
  title: 0.139,
  subtitle: 0.0679,
  discount: 0.095,
  date: 0.0614,
  cta: 0.062,
};

/**
 * 자간 (em) — Figma 값 그대로.
 * 타이틀 -5%, 서브카피 +3%, 기간 0%.
 */
export const LETTER_SPACING = {
  eventTag: 0,
  title: -0.05,
  subtitle: 0.03,
  discount: -0.02,
  date: 0,
  cta: -0.01,
};

/**
 * 줄 간격 — Figma 실측 행간에서 역산.
 * 타이틀 두 줄의 잉크 상단 간격이 100.4px(86px 기준) → 1.17
 * 서브카피 두 줄은 52px(42px 기준) → 1.24
 */
export const LINE_HEIGHT = {
  title: 1.17,
  subtitle: 1.24,
  default: 1.3,
};

/**
 * 캐러셀 인디케이터 스펙 — Figma 원본(1125×840) 좌표에서 비율로 환산.
 *
 *   알약   322 × 84  @ (767, 720)  → 우측 여백 36, 하단 여백 36
 *   재생 원 84 × 84   @ (671, 720)  → 알약 왼쪽에 12px 간격
 *   내부 텍스트 32px — 원본 40px 은 알약 대비 과해 보여 한 단 낮췄다
 *
 * 규격이 달라져도 같은 비율로 놓이도록 높이(=84/840)를 기준 단위로 삼는다.
 * 캐러셀이 있는 지면은 앱 홈 메인 배너뿐이라 그 템플릿에만 붙인다.
 */
export const INDICATOR_SPEC = {
  heightRatio: 84 / 840,
  widthPerHeight: 322 / 84,
  marginRightRatio: 36 / 1125,
  marginVerticalRatio: 36 / 840,
  gapPerHeight: 12 / 84,
  fontPerHeight: 32 / 84,
  label: "32 | 32 전체보기",
};

export const LAYOUT_CHANNELS = [
  { id: "web", label: "웹" },
  { id: "app", label: "앱" },
];

export const LAYOUTS = [
  /* ------------------------------- 웹 ------------------------------- */
  {
    id: "wide-editorial",
    channel: "web",
    name: "와이드 에디토리얼",
    desc: "텍스트 세로 중앙 · 좌측 정렬",
    icon: "▤",
    recommendedSize: "pc-full",
    frame: { radius: "none" },
    // 컬리 PC 풀배너 실측: 타이틀 블록 26%, 서브카피 60%, 기간 88%
    block: { w: "46%", position: "center", align: "left" },
    slots: {
      eventTag: { y: "16%" },
      title: { y: "26%" },
      subtitle: { y: "60%" },
      discount: { y: "74%" },
      date: { y: "88%" },
    },
  },
  {
    id: "center-festa",
    channel: "web",
    name: "센터 페스타",
    desc: "중앙 정렬 · 할인율 강조",
    icon: "◆",
    frame: { radius: "none" },
    block: { w: "80%", position: "center", align: "center" },
    slots: {
      eventTag: { y: "6%" },
      title: { y: "14%" },
      discount: { y: "54%", scale: 1.2 },
      subtitle: { y: "76%" },
      date: { y: "92%" },
    },
  },
  {
    id: "top-headline",
    channel: "web",
    name: "상단 헤드라인",
    desc: "텍스트 상단 · 하단 여백 확보",
    icon: "◰",
    frame: { radius: "none" },
    block: { w: "52%", position: "left", align: "left" },
    slots: {
      eventTag: { y: "6%" },
      title: { y: "13%" },
      subtitle: { y: "50%" },
      discount: { y: "66%" },
      date: { y: "82%" },
    },
  },
  {
    id: "bottom-caption",
    channel: "web",
    name: "하단 캡션",
    desc: "사진 강조 · 텍스트 하단",
    icon: "◱",
    frame: { radius: "none" },
    block: { w: "60%", position: "left", align: "left" },
    slots: {
      eventTag: { y: "30%" },
      title: { y: "38%" },
      subtitle: { y: "72%" },
      date: { y: "92%" },
    },
  },
  {
    id: "impact-sale",
    channel: "web",
    name: "임팩트 세일",
    desc: "할인율 최대 강조 · 중앙",
    icon: "◈",
    frame: { radius: "none" },
    block: { w: "70%", position: "center", align: "center" },
    slots: {
      eventTag: { y: "8%" },
      discount: { y: "18%", scale: 1.8 },
      title: { y: "46%" },
      subtitle: { y: "82%" },
      date: { y: "94%" },
    },
  },

  /* ------------------------------- 앱 ------------------------------- */
  {
    // ① 앱 진입 모달 팝업 — 상단 중앙 정렬 텍스트 + 하단 풀와이드 CTA 바
    id: "app-modal",
    channel: "app",
    name: "앱 모달 팝업",
    desc: "세로형 팝업 · 하단 CTA 바",
    icon: "▣",
    recommendedSize: "app-modal",
    frame: { radius: "all" },
    cta: { style: "bar" },
    block: { w: "86%", position: "center", align: "center" },
    // 실측: 아이브로우 8%, 타이틀 블록 13%, 서브카피 32%, 하단 CTA 바가 10% 차지
    slots: {
      eventTag: { y: "8%" },
      title: { y: "14%" },
      subtitle: { y: "42%" },
      discount: { y: "56%" },
      date: { y: "76%" },
    },
  },
  {
    // ② 앱 홈 메인 배너 (Hero Carousel) — 레퍼런스 실측 그대로
    id: "app-hero",
    channel: "app",
    name: "앱 홈 메인 배너",
    desc: "캐러셀 · 좌측 정렬 2줄 타이틀",
    icon: "◧",
    recommendedSize: "app-hero",
    frame: { radius: "none" },
    indicator: "bottom",
    block: { w: "54%", position: "left", align: "left" },
    // Figma 원본(1125×840) 잉크 위치에서 라인박스 top 을 역산한 값
    //   타이틀 윗줄 잉크 89.5px → 라인박스 74px = 8.8% (Export 실측으로 5px 보정)
    //   굵은 줄 잉크 190px (윗줄 + 86×1.17)
    //   서브카피 잉크 321.9px → 310.9px = 37%
    //   기간 잉크 749.8px → 736.1px = 87.6%
    slots: {
      eventTag: { y: "2%" },
      title: { y: "8.8%" },
      subtitle: { y: "37%" },
      discount: { y: "62%" },
      date: { y: "87.6%" },
    },
  },
  {
    // ③ 하단 시트형 팝업 — 상단만 라운드, 인라인 CTA 버튼 (캐러셀 아님 → 인디케이터 없음)
    id: "app-sheet",
    channel: "app",
    name: "앱 하단 시트 팝업",
    desc: "상단 라운드 · 인라인 CTA",
    icon: "◲",
    recommendedSize: "app-sheet",
    frame: { radius: "top" },
    cta: { style: "button" },
    block: { w: "50%", position: "left", align: "left" },
    // 시트는 상단 24%가 여백 — 텍스트는 그 아래에서 시작한다
    slots: {
      eventTag: { y: "18%" },
      title: { y: "26%" },
      subtitle: { y: "54%" },
      cta: { y: "68%" },
      date: { y: "90%" },
    },
  },
];

/** 텍스트 블록의 수평 배치 */
/**
 * 배치 값의 종류 (옵션 목록이 아니라 문자열 상수다 — UI 는 Figma 식 정렬
 * 아이콘으로 다루므로 라벨이 필요하지 않다. TextStyleControls 참고)
 *
 *   block.position : "left" | "center" | "right" — 블록의 가로 기준점(앵커)
 *   block.align    : "left" | "center" | "right" — 박스 안에서의 글줄 맞춤
 */

/**
 * 폰트 두께 프리셋
 *
 * 컬리 배너는 굵은 헤비 웨이트보다 얇은~중간 두께를 주로 쓴다.
 * titleLead 는 타이틀보다 확실히 가볍게 둔다 (레퍼런스의 Regular / Bold 대비).
 */
export const TEXT_WEIGHTS = [
  {
    id: "light",
    label: "가볍게",
    desc: "얇은 두께 · 정갈한 톤",
    weights: {
      eventTag: 300,
      titleLead: 300,
      title: 400,
      subtitle: 300,
      discount: 400,
      date: 300,
      cta: 500,
    },
  },
  {
    id: "regular",
    label: "기본",
    desc: "Figma 기준 (Regular + Medium)",
    weights: {
      eventTag: 400,
      titleLead: 400,
      title: 500,
      subtitle: 400,
      discount: 500,
      date: 400,
      cta: 600,
    },
  },
  {
    id: "bold",
    label: "굵게",
    desc: "세일·강조용",
    weights: {
      eventTag: 500,
      titleLead: 500,
      title: 700,
      subtitle: 500,
      discount: 700,
      date: 500,
      cta: 700,
    },
  },
];

/** 이벤트 태그 표현 방식 */
export const TAG_STYLES = [
  { id: "text", label: "텍스트", desc: "잔글씨 한 줄" },
  { id: "badge", label: "뱃지", desc: "색 배경 뱃지" },
];

/**
 * 배너에 실제로 굽는 모듈 목록.
 * 캐러셀 인디케이터는 지면 UI 라 배너 이미지에 포함되면 안 되므로
 * 모듈이 아니라 "미리보기 전용 오버레이"로 분리했다 (BannerRenderer 참고).
 */
export const MODULE_DEFS = [
  { id: "eventTag", label: "이벤트 태그", defaultOn: false },
  { id: "title", label: "메인 타이틀", defaultOn: true },
  { id: "subtitle", label: "서브 카피", defaultOn: true },
  { id: "discount", label: "할인 뱃지", defaultOn: false },
  { id: "date", label: "기간 표시", defaultOn: true },
  { id: "cta", label: "CTA 버튼", defaultOn: true },
];

/** 모듈 기본 ON/OFF — MODULE_DEFS 의 defaultOn 을 그대로 쓴다 */
export const DEFAULT_MODULES = MODULE_DEFS.reduce(
  (acc, m) => ({ ...acc, [m.id]: m.defaultOn }),
  {},
);

export const CONTENT_DEFAULTS = {
  eventTag: "오직 앱에서만 가능한 첫 구매 혜택",
  // 타이틀은 두 줄 구성 — 윗줄은 Regular, 아랫줄은 Bold
  titleLead: "컬리와 함께하는",
  title: "9월의 결제 혜택",
  subtitle: "케이뱅크 이용하고\n최대 21,000원 혜택",
  discount: "최대 50% 할인",
  date: "09.01 - 09.30",
  cta: "지금 바로 가입하고 혜택 받기",
};

/** 블록이 캔버스 가장자리에서 떨어지는 여백 (%) — Figma 텍스트 좌측 원점 ≈ 68/1125 */
/** 캔버스 좌우/상하 기본 여백 (%) — 정렬 버튼도 이 값을 기준으로 붙인다 */
export const EDGE_PAD = 6;

/**
 * 템플릿이 "이 모듈은 비울 수 없다"고 선언했는지.
 * 컬리 템플릿은 아직 requiredModules 를 쓰지 않아 항상 false 다 —
 * 선언하면 모듈 토글이 잠기고 "필수" 뱃지가 붙는다.
 */
export function isRequiredModule(layout, moduleId) {
  return Boolean(layout?.requiredModules?.includes(moduleId));
}

export function getTextWeights(weightId) {
  return (TEXT_WEIGHTS.find((w) => w.id === weightId) || TEXT_WEIGHTS[1]).weights;
}

/** 프레임 라운드 값 (CSS border-radius) — 팝업/시트 에셋은 코너가 둥글다 */
export function getFrameRadius(layout, size) {
  const radius = layout.frame?.radius || "none";
  if (radius === "none") return 0;
  const r = Math.round(Math.min(size.w, size.h) * 0.035);
  return radius === "top" ? `${r}px ${r}px 0 0` : `${r}px`;
}

/**
 * 레이아웃(수직 구성) + 사용자 설정(배치/정렬) → 슬롯 박스 좌표
 *
 * 모든 텍스트 모듈이 같은 폭(block.w)을 공유하므로, 정렬을 바꾸면
 * 태그·타이틀·서브카피·기간의 정렬선이 함께 움직인다.
 */
export function resolveSlotBox(layout, moduleId, { position, align } = {}) {
  const slot = layout.slots[moduleId];
  if (!slot) return null;

  const pos = position || layout.block.position;
  const x = pos === "left" ? `${EDGE_PAD}%` : pos === "right" ? `${100 - EDGE_PAD}%` : "50%";
  const transform =
    pos === "left" ? "none" : pos === "right" ? "translateX(-100%)" : "translateX(-50%)";

  return {
    x,
    y: slot.y,
    transform,
    align: align || layout.block.align,
    w: slot.w || layout.block.w,
    scale: slot.scale || 1,
  };
}
