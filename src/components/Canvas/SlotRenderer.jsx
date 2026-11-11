import { LETTER_SPACING, LINE_HEIGHT, TYPE_RATIO } from "../../constants/layouts";
// 타이틀 크기 계산은 lib/titleFit 에 모아 두었다 — 입력칸의 글자 수 상한이
// 같은 함수를 쓴다. 여기서 따로 계산하면 둘이 조용히 어긋난다.
import { getTitleSize, getTypeBase } from "../../lib/titleFit";

/**
 * SlotRenderer
 *
 * 모듈의 "시각적 표현"만 담당한다. 위치는 SlotBox 가 처리.
 *
 * 주의: 이 컴포넌트는 항상 배너 원본 픽셀 크기(bannerSize) 기준으로 렌더된다.
 * 프리뷰 축소는 상위에서 CSS transform 으로 처리하므로 여기서 배율을 곱하면 안 된다.
 */

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
      // 입력은 한 칸이고 Enter 로 줄을 나눈다. **줄마다 두께를 달리하지 않는다** —
      // 굵기 대비는 타이틀과 서브 타이틀 사이에서만 준다.
      //
      // 크기도 글자 수에 따라 변하지 않는다. 길면 줄이던 예전 방식은 한 글자 차이로
      // 타이틀이 확 작아졌고, 입력칸의 한도 숫자까지 따라 흔들렸다.
      // 넘치는 입력은 lib/titleFit 이 입력 단계에서 막는다.
      return (
        <div
          style={{
            fontSize: getTitleSize(bannerSize) * scale,
            fontWeight: weights.title,
            color: theme.text,
            lineHeight: LINE_HEIGHT.title,
            letterSpacing: `${LETTER_SPACING.title}em`,
            wordBreak: "keep-all",
            whiteSpace: "pre-wrap",
          }}
        >
          {content.title}
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
