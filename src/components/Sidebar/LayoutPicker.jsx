import { LAYOUTS } from "../../constants/layouts";
import SidebarSection from "../ui/SidebarSection";

export default function LayoutPicker({ selected, onSelect, channel }) {
  const layouts = LAYOUTS.filter((l) => l.channel === channel);

  return (
    <SidebarSection title="레이아웃 템플릿">
      {/* 선택 카드 — DS Card 라운드(12)에 1px 선. 선택해도 선 두께를 바꾸지 않아
          목록이 밀리지 않는다 (선택 표시는 primary 알파 선 + blue-95 바탕). */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {layouts.map((l) => {
          const active = selected === l.id;
          return (
            <button
              key={l.id}
              onClick={() => onSelect(l.id)}
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-lg)",
                border: `1px solid ${active ? "var(--color-primary-line)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary-light)" : "var(--color-card)",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                className="ty-heading2"
                style={{
                  color: active ? "var(--color-primary-text)" : "var(--color-text-muted)",
                }}
              >
                {l.icon}
              </span>
              <div>
                <div
                  className="ty-label1"
                  style={{
                    fontWeight: "var(--font-weight-bold)",
                    color: active ? "var(--color-primary-text)" : "var(--color-text-primary)",
                  }}
                >
                  {l.name}
                </div>
                <div className="ty-caption2" style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
                  {l.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </SidebarSection>
  );
}
