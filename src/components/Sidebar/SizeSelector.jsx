import { SIZES } from "../../constants/sizes";
import SidebarSection from "../ui/SidebarSection";
import Chip from "../ui/Chip";

/**
 * 템플릿의 권장 규격과 비율이 얼마나 다른지.
 * 템플릿의 y 값은 권장 규격 기준으로 잡혀 있어, 비율이 크게 다르면
 * 텍스트 간격이 의도와 달라진다. 그 사실을 숨기지 않고 알려 준다.
 */
function aspectGap(size, recommended) {
  if (!recommended) return 0;
  return Math.abs(size.w / size.h / (recommended.w / recommended.h) - 1);
}

export default function SizeSelector({ selected, onSelect, channel, recommendedId, layoutName }) {
  const sizes = SIZES.filter((s) => s.channel === channel);
  const recommended = SIZES.find((s) => s.id === recommendedId);
  const mismatch = recommended && recommended.id !== selected.id && aspectGap(selected, recommended) > 0.35;

  return (
    <SidebarSection title="배너 사이즈">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sizes.map((s) => (
          <Chip key={s.id} selected={selected.id === s.id} onClick={() => onSelect(s)}>
            {s.label}
            {s.id === recommendedId && (
              /* DS ContentBadge 톤 — xs 라운드(6)에 caption2 */
              <span
                className="ty-caption2"
                style={{
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-primary-text)",
                  background: "var(--color-primary-light)",
                  borderRadius: "var(--radius-xs)",
                  padding: "2px 6px",
                }}
              >
                권장
              </span>
            )}
          </Chip>
        ))}
      </div>

      <div
        className="ty-caption1"
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-text-secondary)",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontWeight: "var(--font-weight-medium)" }}>
          {selected.w} × {selected.h}px
        </span>
        <span>{selected.desc}</span>
      </div>

      {mismatch && (
        /* 주의 안내 — status cautionary 의 배경/전경 토큰 쌍 */
        <div
          className="ty-caption2"
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-warning-bg)",
            color: "var(--color-warning-text)",
            lineHeight: 1.55,
          }}
        >
          {layoutName} 템플릿은 {recommended.label} ({recommended.w}×{recommended.h}) 기준입니다.
          비율이 많이 달라 텍스트 간격이 의도와 다를 수 있어요 — 위치 편집으로 조정하거나
          권장 규격을 쓰세요.
        </div>
      )}
    </SidebarSection>
  );
}
