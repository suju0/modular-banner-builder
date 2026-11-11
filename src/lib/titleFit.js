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

/** 텍스트가 길면 타이틀을 줄인다 (레이아웃이 깨지는 것보다 낫다) */
export function getTitleSize(bannerSize, textLength) {
  const base = getTypeBase(bannerSize) * TYPE_RATIO.title;
  if (textLength > 20) return base * 0.72;
  if (textLength > 12) return base * 0.86;
  return base;
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

const longestLength = (lines) => lines.reduce((max, l) => Math.max(max, l.length), 0);

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
 * 그 줄에 들어가는 글자 수 상한.
 *
 * 이미 넘쳤으면 들어가는 데까지 잘라 본 길이를, 여유가 있으면 한글을 더 넣어 보며
 * 넘치기 직전까지의 길이를 돌려준다. 상한은 "지금 이 줄 기준"이라 글자를 지우면
 * 다시 늘어난다 — 폰트가 계단식으로 커졌다 작아졌다 하기 때문이다.
 */
export function lineCapacity(line, fontSizePx, boxWidth) {
  if (!boxWidth) return line.length;

  if (measureTitleWidth(line, fontSizePx) > boxWidth) {
    let lo = 0;
    let hi = line.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measureTitleWidth(line.slice(0, mid), fontSizePx) <= boxWidth) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  let probe = line;
  let cap = line.length;
  // 한 줄이 60자를 넘어갈 규격은 없다 — 측정이 꼬여도 여기서 멈춘다
  while (cap - line.length < 60) {
    probe += "가";
    if (measureTitleWidth(probe, fontSizePx) > boxWidth) break;
    cap += 1;
  }
  return cap;
}

/**
 * 입력값을 2줄 · 줄당 폭 안으로 자른다.
 * trimmed 는 실제로 잘렸는지 — 입력이 막혔다는 신호를 보여 줄 때 쓴다.
 */
export function clampTitle(value, bannerSize, layout) {
  const text = String(value ?? "");
  const box = getTitleBlockWidth(bannerSize, layout);
  const all = text.split("\n");

  let trimmed = all.length > MAX_TITLE_LINES;
  const lines = all.slice(0, MAX_TITLE_LINES);
  const fontSize = getTitleSize(bannerSize, longestLength(lines));

  const next = lines.map((line) => {
    const cap = lineCapacity(line, fontSize, box);
    if (line.length <= cap) return line;
    trimmed = true;
    return line.slice(0, cap);
  });

  return { value: next.join("\n"), trimmed };
}

/** 줄별 [쓴 글자 수, 상한] — 카운터 표시용 */
export function titleLineCounts(value, bannerSize, layout) {
  const box = getTitleBlockWidth(bannerSize, layout);
  const lines = String(value ?? "").split("\n").slice(0, MAX_TITLE_LINES);
  const fontSize = getTitleSize(bannerSize, longestLength(lines));
  return lines.map((line) => ({
    used: line.length,
    max: lineCapacity(line, fontSize, box),
  }));
}
