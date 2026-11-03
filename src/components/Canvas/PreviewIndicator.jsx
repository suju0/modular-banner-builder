import { INDICATOR_SPEC } from "../../constants/layouts";

/**
 * PreviewIndicator
 *
 * 앱 캐러셀의 인디케이터 + 재생 버튼. **미리보기 전용 오버레이**다.
 * 지면(앱)이 그리는 UI 라 배너 이미지에 포함되면 안 되므로
 * data-export-ignore 를 붙이고, Export 경로에는 플래그를 넘기지 않는다.
 *
 * 좌표·크기는 Figma 원본(1125×840)에서 그대로 환산했다.
 *   알약   322 × 84 @ (767, 720)  · 우측 36 / 하단 36
 *   재생 원 84 × 84 @ (671, 720)  · 알약 왼쪽 12px
 * 다른 규격에서도 같은 비율로 놓이도록 높이를 기준 단위로 쓴다.
 *
 * 알약과 재생 버튼은 **캔버스의 가장 위 레이어**다 (z-index 40). 지면에서 배너
 * 위에 얹히는 UI 이기 때문이다. z-index 를 주지 않으면 가독성 그라데이션(1)·
 * 텍스트(2)·CTA 바(3) 가 위를 덮는다 — DOM 순서가 뒤라도 z-index 가 auto 면
 * 값이 있는 형제들보다 아래에 깔린다. pointerEvents: none 이라 맨 위에 있어도
 * 이미지 조정 핸들 조작을 막지 않는다.
 */

/** 캔버스 레이어 최상단 — BannerRenderer 의 레이어 표와 함께 관리한다 */
export const INDICATOR_Z = 40;
export default function PreviewIndicator({ size, position = "bottom", label }) {
  const h = size.h * INDICATOR_SPEC.heightRatio;
  const w = h * INDICATOR_SPEC.widthPerHeight;
  const right = size.w * INDICATOR_SPEC.marginRightRatio;
  const offsetY = size.h * INDICATOR_SPEC.marginVerticalRatio;
  const gap = h * INDICATOR_SPEC.gapPerHeight;
  const fontSize = h * INDICATOR_SPEC.fontPerHeight;
  const vertical = position === "top" ? { top: offsetY } : { bottom: offsetY };

  return (
    <div
      data-export-ignore=""
      style={{
        position: "absolute",
        inset: 0,
        zIndex: INDICATOR_Z,
        pointerEvents: "none",
      }}
    >
      {/* 재생/일시정지 버튼 — 알약 왼쪽 */}
      <div
        style={{
          position: "absolute",
          right: right + w + gap,
          ...vertical,
          width: h,
          height: h,
          borderRadius: "50%",
          background: "rgba(var(--semantic-static-black-rgb), 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: h * 0.09,
        }}
      >
        {/* 원본 SVG 에는 아이콘 패스가 없지만, 실제 지면에는 일시정지 아이콘이 있다 */}
        {[0, 1].map((i) => (
          <span
            key={i}
            style={{
              width: h * 0.08,
              height: h * 0.33,
              borderRadius: h * 0.04,
              background: "var(--semantic-static-white)",
            }}
          />
        ))}
      </div>

      {/* 인디케이터 알약 */}
      <div
        style={{
          position: "absolute",
          right,
          ...vertical,
          width: w,
          height: h,
          borderRadius: h / 2,
          background: "rgba(var(--semantic-static-black-rgb), 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: h * 0.12,
          color: "var(--semantic-static-white)",
          fontFamily: "var(--font-family)",
          fontSize,
          fontWeight: "var(--font-weight-medium)",
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        {label || INDICATOR_SPEC.label}
        {/* 우측 꺾쇠 — SVG 의 stroke 4 / 12×24 비율 */}
        <svg
          width={h * 0.17}
          height={h * 0.29}
          viewBox="0 0 14 26"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <path d="M2 2L12 13L2 24" stroke="var(--semantic-static-white)" strokeWidth="4" />
        </svg>
      </div>
    </div>
  );
}
