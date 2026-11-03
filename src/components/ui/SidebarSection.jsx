import { useState } from "react";

/**
 * SidebarSection — 우측 디자인 패널의 섹션 (Figma 우측 패널 구성)
 *
 *   [제목 ▾]                         [actions]
 *   본문
 *
 * 제목을 누르면 접히고, 오른쪽 actions 자리에는 섹션 단위 동작(+, 아이콘 토글 등)을 둔다.
 * 섹션 사이는 얇은 구분선 하나로만 나눈다 — 카드처럼 박스를 씌우지 않는다.
 *
 * Montage 규격: 가로 여백은 패널 거터(20px) 하나로 통일하고, 머리 높이는
 * 컨트롤 lg(48px)에 맞춘다. 제목은 label1 bold(=600), 화살표는 label-alternative.
 */
export default function SidebarSection({ title, children, defaultOpen = true, actions = null }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px var(--panel-gutter)",
          minHeight: "var(--control-height-lg)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="ty-label1"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
            background: "none",
            border: "none",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text-primary)",
            textAlign: "left",
          }}
        >
          {title}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
            style={{
              color: "var(--color-text-muted)",
              transition: "transform 0.15s",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              flexShrink: 0,
            }}
          >
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 2 }}>{actions}</div>}
      </div>
      {open && <div style={{ padding: "0 var(--panel-gutter) var(--spacing-20)" }}>{children}</div>}
    </section>
  );
}

/** 섹션 안 소제목 — "색상", "위치" 같은 묶음 이름 */
export function FieldLabel({ children, style }) {
  return (
    <div
      className="ty-caption1"
      style={{
        fontWeight: "var(--font-weight-medium)",
        color: "var(--color-text-muted)",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 섹션 제목 오른쪽 아이콘 버튼 — DS IconButton sm(32px, r8) */
export function SectionAction({ title, onClick, active = false, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: "var(--control-height-sm)",
        height: "var(--control-height-sm)",
        borderRadius: "var(--radius-sm)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--color-fill)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
      }}
    >
      {children}
    </button>
  );
}
