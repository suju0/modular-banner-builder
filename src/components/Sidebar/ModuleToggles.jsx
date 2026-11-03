import { MODULE_DEFS, isRequiredModule } from "../../constants/layouts";
import SidebarSection from "../ui/SidebarSection";
import Toggle from "../ui/Toggle";

/**
 * 현재 레이아웃이 그 모듈을 그릴 수 있는지.
 *
 * CTA 는 앱 지면 전용 요소라 웹 템플릿에는 그릴 자리가 없다.
 * 켜도 아무 일이 없으면 사용자가 원인을 못 찾으므로 지원 여부를 표시한다.
 */
function isSupported(layout, moduleId) {
  if (!layout) return true;
  if (moduleId === "cta") return Boolean(layout.cta);
  return Boolean(layout.slots[moduleId]);
}

export default function ModuleToggles({ modules, onToggle, layout }) {
  return (
    <SidebarSection title="모듈 표시">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MODULE_DEFS.map((m) => {
          const supported = isSupported(layout, m.id);
          const required = isRequiredModule(layout, m.id);
          return (
            <div
              key={m.id}
              title={
                required
                  ? `${layout?.name} 의 필수 영역이라 끌 수 없습니다`
                  : supported
                    ? undefined
                    : `${layout?.name} 템플릿에는 이 모듈 자리가 없습니다`
              }
              style={{
                opacity: supported ? 1 : 0.4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Toggle
                checked={required || modules[m.id]}
                onChange={() => !required && onToggle(m.id)}
                label={m.label}
              />
              {required && (
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
                  필수
                </span>
              )}
              {!supported && (
                <span
                  className="ty-caption2"
                  style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-medium)" }}
                >
                  미지원
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SidebarSection>
  );
}
