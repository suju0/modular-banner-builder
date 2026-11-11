import { LETTER_SPACING, TYPE_RATIO } from "../constants/layouts";

/**
 * 타이틀이 블록 안에 들어가는지 재는 곳.
 *
 * 한 줄에 몇 자가 들어가는지는 **고정 숫자로 정할 수 없다.** 같은 문장도
 * 규격(배너 폭)과 템플릿(블록 비율)에 따라 들어가는 양이 다르다.
 *
 *   앱 홈 메인 1125×840 · 블록 54% → 607px → 86px 글자로 약 7자
 *   앱 모달 1080×1240 · 블록 86% → 929px → 83px 글자로 약 11자
 *   PC 풀배너 1920×360 · 블록 46% → 883px → 50px 글자로 약 18자
 *
 * 그래서 "글자 수"가 아니라 **실제로 그려질 폭**을 재서 상한을 정한다.
 * 렌더러(SlotRenderer)와 같은 함수를 쓰므로 둘이 어긋날 수 없다.
 */

export const MAX_TITLE_LINES = 2;

/**
 * 타입 스케일 기준값.
 *
 * 높이만 기준으로 삼으면 PC 풀배너(1920×360)처럼 납작한 규격에서 글자가 과도하게
 * 작아진다. 가로 여유도 함께 반영해 비율이 달라도 시각적 크기가 비슷하게 유지된다.
 */
export function getTypeBase({ w, h }) {
  return Math.min(h, w * 0.55);
}

/**
 * 타이틀 크기 — 규격이 정한다. **글자 수에 따라 변하지 않는다.**
 *
 * 예전에는 12자·20자에서 86%·72% 로 줄였다. 글자를 더 쓰면 폰트가 작아지고,
 * 작아지면 더 들어가니 상한이 따라 올라가서 "한도 숫자가 자꾸 바뀌는" 문제가 됐다.
 * 넘치는 입력은 이제 입력 단계에서 막으므로 줄여서 맞출 이유가 없다.
 * Figma 원본도 타이틀을 86px 고정으로 쓴다.
 */
export function getTitleSize(bannerSize) {
  return getTypeBase(bannerSize) * TYPE_RATIO.title;
}

/** 타이틀 블록의 실제 폭(배너 px). layout.block.w 는 "54%" 같은 문자열이다 */
export function getTitleBlockWidth(bannerSize, layout) {
  const raw = layout?.block?.w;
  const ratio =
    typeof raw === "string" && raw.trim().endsWith("%")
      ? parseFloat(raw) / 100
      : Number(raw) || 1;
  return bannerSize.w * ratio;
}

/**
 * 폭 측정자.
 *
 * canvas measureText 는 자간(letter-spacing)을 반영하지 않는 브라우저가 있어
 * 숨긴 span 으로 잰다. 폰트는 body 에서 물려받으므로 배너와 같은 Pretendard 다.
 */
let ruler = null;
function getRuler() {
  if (ruler && ruler.isConnected) return ruler;
  ruler = document.createElement("span");
  ruler.setAttribute("aria-hidden", "true");
  Object.assign(ruler.style, {
    position: "absolute",
    top: "-9999px",
    left: "-9999px",
    whiteSpace: "pre",
    visibility: "hidden",
    pointerEvents: "none",
  });
  document.body.appendChild(ruler);
  return ruler;
}

export function measureTitleWidth(text, fontSizePx, fontWeight = 500) {
  if (!text || typeof document === "undefined") return 0;
  const el = getRuler();
  el.style.fontWeight = String(fontWeight);
  el.style.fontSize = `${fontSizePx}px`;
  el.style.letterSpacing = `${LETTER_SPACING.title}em`;
  el.textContent = text;
  return el.offsetWidth;
}

/**
 * 한 줄에 쓸 수 있는 글자 수 — **규격·템플릿이 정하는 고정값이다.**
 *
 * 무엇을 입력했는지는 보지 않는다. 입력한 글자로 재면 좁은 글자(영문·공백)를
 * 쓸 때마다 한도가 늘었다 줄었다 해서 화면의 숫자를 믿을 수 없게 된다.
 * 그래서 한글에서 가장 넓은 축인 '가' 를 기준으로 한 번만 잰다.
 */
const limitCache = new Map();

/** 폰트가 늦게 떠서 다시 재야 할 때 (ContentEditor 가 fonts.ready 에서 부른다) */
export function resetTitleFitCache() {
  limitCache.clear();
}

export function lineCharLimit(bannerSize, layout) {
  const box = getTitleBlockWidth(bannerSize, layout);
  if (!box) return 1;

  // 한 번 재면 규격·템플릿이 바뀌기 전까지 같은 값이다.
  // 글자마다 다시 재면 타이핑할 때 DOM 측정이 수십 번씩 돈다.
  const key = `${bannerSize.w}x${bannerSize.h}@${box}`;
  const cached = limitCache.get(key);
  if (cached !== undefined) return cached;

  const fontSize = getTitleSize(bannerSize);
  let probe = "";
  let limit = 0;
  // 한 줄이 60자를 넘어갈 규격은 없다 — 측정이 꼬여도 여기서 멈춘다
  while (limit < 60) {
    probe += "가";
    if (measureTitleWidth(probe, fontSize) > box) break;
    limit += 1;
  }
  const result = Math.max(1, limit);
  limitCache.set(key, result);
  return result;
}

/**
 * 입력값을 2줄 · 줄당 고정 글자 수 안으로 자른다.
 * trimmed 는 실제로 잘렸는지 — 입력이 막혔다는 신호를 보여 줄 때 쓴다.
 */
export function clampTitle(value, bannerSize, layout) {
  const all = String(value ?? "").split("\n");
  const limit = lineCharLimit(bannerSize, layout);

  let trimmed = all.length > MAX_TITLE_LINES;
  const next = all.slice(0, MAX_TITLE_LINES).map((line) => {
    if (line.length <= limit) return line;
    trimmed = true;
    return line.slice(0, limit);
  });

  return { value: next.join("\n"), trimmed };
}

/** 줄별 [쓴 글자 수, 상한] — 카운터 표시용. 상한은 두 줄 모두 같다. */
export function titleLineCounts(value, bannerSize, layout) {
  const limit = lineCharLimit(bannerSize, layout);
  return String(value ?? "")
    .split("\n")
    .slice(0, MAX_TITLE_LINES)
    .map((line) => ({ used: line.length, max: limit }));
}
