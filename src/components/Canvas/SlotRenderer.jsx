import { LETTER_SPACING, LINE_HEIGHT, TYPE_RATIO } from "../../constants/layouts";

/**
 * SlotRenderer
 *
 * 모듈의 "시각적 표현"만 담당한다. 위치는 SlotBox 가 처리.
 *
 * 주의: 이 컴포넌트는 항상 배너 원본 픽셀 크기(bannerSize) 기준으로 렌더된다.
 * 프리뷰 축소는 상위에서 CSS transform 으로 처리하므로 여기서 배율을 곱하면 안 된다.
 */

/**
 * 타입 스케일 기준값.
 *
 * 높이만 기준으로 삼으면 PC 풀배너(1920×360)처럼 납작한 규격에서 글자가 과도하게
 * 작아진다. 가로 여유도 함께 반영해 비율이 달라도 시각적 크기가 비슷하게 유지된다.
 */
function getTypeBase({ w, h }) {
  return Math.min(h, w * 0.55);
}

/** 텍스트가 길면 타이틀을 줄인다 (레이아웃이 깨지는 것보다 낫다) */
function getTitleSize(bannerSize, textLength) {
  const base = getTypeBase(bannerSize) * TYPE_RATIO.title;
  if (textLength > 20) return base * 0.72;
  if (textLength > 12) return base * 0.86;
  return base;
}

export default function SlotRenderer({
  moduleId,
  content,
  theme,
  bannerSize,
  weights,
  tagStyle = "text",
  scale = 1,
}) {
  const base = getTypeBase(bannerSize);
  const size = (ratio) => Math.max(8, base * ratio * scale);

  switch (moduleId) {
    case "eventTag": {
      const common = {
        display: "inline-block",
        fontSize: size(TYPE_RATIO.eventTag),
        fontWeight: weights.eventTag,
        letterSpacing: `${LETTER_SPACING.eventTag}em`,
        lineHeight: LINE_HEIGHT.default,
        whiteSpace: "nowrap",
      };

      // 컬리 배너에서 흔한 형태: 타이틀 위 잔글씨 한 줄
      if (tagStyle === "text") {
        return <span style={{ ...common, color: theme.text }}>{content.eventTag}</span>;
      }

      return (
        <span
          style={{
            ...common,
            padding: `${base * 0.012 + 2}px ${base * 0.038 + 4}px`,
            borderRadius: 4,
            background: theme.badge,
            color: theme.badgeText,
            letterSpacing: "0.05em",
          }}
        >
          {content.eventTag}
        </span>
      );
    }

    case "title": {
      // 레퍼런스 구성: 윗줄은 Regular, 아랫줄은 Bold — 크기는 같고 두께만 다르다
      const longest = Math.max((content.title || "").length, (content.titleLead || "").length);
      const common = {
        fontSize: getTitleSize(bannerSize, longest) * scale,
        color: theme.text,
        lineHeight: LINE_HEIGHT.title,
        letterSpacing: `${LETTER_SPACING.title}em`,
        wordBreak: "keep-all",
        whiteSpace: "pre-wrap",
      };

      return (
        <div>
          {content.titleLead ? (
            <div style={{ ...common, fontWeight: weights.titleLead }}>{content.titleLead}</div>
          ) : null}
          <div style={{ ...common, fontWeight: weights.title }}>{content.title}</div>
        </div>
      );
    }

    case "subtitle":
      return (
        <div
          style={{
            fontSize: size(TYPE_RATIO.subtitle),
            fontWeight: weights.subtitle,
            color: theme.sub,
            lineHeight: LINE_HEIGHT.subtitle,
            letterSpacing: `${LETTER_SPACING.subtitle}em`,
            wordBreak: "keep-all",
            whiteSpace: "pre-wrap",
          }}
        >
          {content.subtitle}
        </div>
      );

    case "discount":
      return (
        <span
          style={{
            display: "inline-block",
            fontSize: size(TYPE_RATIO.discount),
            fontWeight: weights.discount,
            color: theme.accent,
            letterSpacing: `${LETTER_SPACING.discount}em`,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
          }}
        >
          {content.discount}
        </span>
      );

    case "date":
      return (
        <span
          style={{
            display: "inline-block",
            fontSize: size(TYPE_RATIO.date),
            fontWeight: weights.date,
            color: theme.sub,
            letterSpacing: `${LETTER_SPACING.date}em`,
            lineHeight: LINE_HEIGHT.default,
            whiteSpace: "nowrap",
          }}
        >
          {content.date}
        </span>
      );

    case "cta":
      // 인라인 CTA 버튼 (하단 시트형). 풀와이드 바 형태는 BannerRenderer 가 그린다.
      return (
        <span
          style={{
            display: "inline-block",
            padding: `${base * 0.05}px ${base * 0.11}px`,
            borderRadius: Math.max(4, base * 0.018),
            background: theme.cta,
            color: theme.ctaText,
            fontSize: size(TYPE_RATIO.cta),
            fontWeight: weights.cta,
            letterSpacing: `${LETTER_SPACING.cta}em`,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
          }}
        >
          {content.cta}
        </span>
      );

    default:
      return null;
  }
}
