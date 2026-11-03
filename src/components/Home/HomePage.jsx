import { BUILDER_GROUPS, countBuilders } from "../../constants/builders";
import KurlyLogo from "../ui/KurlyLogo";
import BuilderIcon from "./BuilderIcon";

/**
 * HomePage
 *
 * 첫 진입 화면. 바로 편집기로 들어가지 않고 **어떤 빌더를 쓸지 고르는 허브**다.
 * 목록은 constants/builders.js 의 BUILDER_GROUPS 를 그대로 그린다 —
 * 이 컴포넌트는 어떤 빌더가 있는지 모르고, 빌더가 늘어도 손댈 일이 없다.
 */

const sidebarLabel = {
  fontSize: "var(--font-label2-size)",
  lineHeight: "var(--font-label2-line)",
  letterSpacing: "var(--font-label2-ls)",
  color: "var(--color-text-secondary)",
  fontWeight: "var(--font-weight-medium)",
};

function CountRow({ label, value, tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={sidebarLabel}>{label}</span>
      {/* 숫자 뱃지 — DS PushBadge 처럼 완전 라운드 */}
      <span
        className="ty-caption1"
        style={{
          minWidth: 28,
          textAlign: "center",
          padding: "2px 8px",
          borderRadius: "var(--radius-full)",
          fontWeight: "var(--font-weight-bold)",
          fontVariantNumeric: "tabular-nums",
          color: tone === "live" ? "var(--color-primary-text)" : "var(--color-text-muted)",
          background: tone === "live" ? "var(--color-primary-light)" : "var(--color-fill)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BuilderCard({ builder, onOpen }) {
  const planned = builder.status === "planned";

  return (
    <button
      type="button"
      disabled={planned}
      onClick={() => onOpen(builder)}
      aria-label={`${builder.name} 열기`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 20,
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--color-border)",
        background: planned ? "var(--color-surface)" : "var(--color-card)",
        textAlign: "left",
        cursor: planned ? "default" : "pointer",
        opacity: planned ? 0.62 : 1,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (planned) return;
        e.currentTarget.style.borderColor = "var(--color-primary-line)";
        e.currentTarget.style.boxShadow = "var(--shadow-raised)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: planned ? "var(--color-fill)" : "var(--color-primary-light)",
          color: planned ? "var(--color-text-muted)" : "var(--color-primary)",
        }}
      >
        <BuilderIcon name={builder.icon} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          className="ty-body1"
          style={{
            display: "block",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text-primary)",
          }}
        >
          {builder.name}
        </span>
        <span
          className="ty-label2"
          style={{
            display: "block",
            marginTop: 4,
            color: "var(--color-text-secondary)",
          }}
        >
          {builder.desc}
        </span>
      </span>

      {planned ? (
        <span
          className="ty-caption2"
          style={{
            flexShrink: 0,
            padding: "2px 8px",
            borderRadius: "var(--radius-xs)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text-muted)",
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          예정
        </span>
      ) : (
        <span style={{ flexShrink: 0, color: "var(--color-text-muted)" }}>
          <BuilderIcon name="chevron" size={18} />
        </span>
      )}
    </button>
  );
}

export default function HomePage({ onOpen }) {
  const live = countBuilders("live");
  const planned = countBuilders("planned");

  return (
    <div style={{ height: "100%", display: "flex", background: "var(--color-surface)" }}>
      {/* 사이드바 — 브랜드와 현황 */}
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          background: "var(--color-card)",
          borderRight: "1px solid var(--color-border)",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ color: "var(--color-brand)" }}>
          <KurlyLogo height={24} />
        </div>

        <div>
          <div
            className="ty-headline1"
            style={{
              fontWeight: "var(--font-weight-bold)",
              color: "var(--color-text-primary)",
            }}
          >
            마케팅디자인
            <br />
            운영 빌더
          </div>
          <div className="ty-caption1" style={{ marginTop: 8, color: "var(--color-text-muted)" }}>
            프로모션 소재 생성 도구
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <CountRow label="활성 빌더" value={live} tone="live" />
          {planned > 0 && <CountRow label="준비 중" value={planned} />}
        </div>

        <div style={{ flex: 1 }} />

        <div className="ty-caption2" style={{ lineHeight: 1.7, color: "var(--color-text-muted)" }}>
          컬리 마케팅디자인팀
          <br />
          Powered by Claude
        </div>
      </aside>

      {/* 빌더 목록 */}
      <main data-autohide-scroll="" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "40px 24px 56px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          {BUILDER_GROUPS.map((group) => (
            <section key={group.id}>
              <h2
                className="ty-label1"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span style={{ color: "var(--color-primary)" }}>
                  <BuilderIcon name={group.icon} size={16} />
                </span>
                {group.label}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {group.builders.map((builder) => (
                  <BuilderCard key={builder.id} builder={builder} onOpen={onOpen} />
                ))}
              </div>
            </section>
          ))}

          <p
            className="ty-label2"
            style={{
              margin: 0,
              padding: 16,
              borderRadius: "var(--radius-lg)",
              background: "var(--color-card)",
              border: "1px dashed var(--color-border)",
              lineHeight: 1.7,
              color: "var(--color-text-muted)",
            }}
          >
            기획전 빌더 · CRM 소재 빌더처럼 새 지면이 필요해지면 이 목록에 순서대로
            추가됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
