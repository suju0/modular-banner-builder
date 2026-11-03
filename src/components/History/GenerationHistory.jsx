export default function GenerationHistory({ history, onDownload, onRestore, onClear }) {
  return (
    <div
      data-autohide-scroll=""
      style={{
        height: "var(--history-height)",
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        padding: "16px 20px",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div className="ty-label1" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)" }}>
          생성 히스토리
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="ty-caption1" style={{ color: "var(--color-text-muted)" }}>{history.length}건</span>
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="ty-caption1"
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                fontWeight: "var(--font-weight-medium)",
              }}
            >
              전체 삭제
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div
          className="ty-label2"
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--color-text-muted)",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          아직 생성된 배너가 없습니다. 설정 후 "생성 + 다운로드"를 눌러주세요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((h, i) => (
            <div
              key={h.id}
              className="ty-label2"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: i === 0 ? "var(--color-primary-light)" : "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              {h.thumb ? (
                <img
                  src={h.thumb}
                  alt=""
                  style={{
                    width: 54,
                    height: 34,
                    objectFit: "cover",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--color-border)",
                    flexShrink: 0,
                    background: "var(--semantic-static-white)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 54,
                    height: 34,
                    borderRadius: "var(--radius-xs)",
                    background: "var(--color-fill-strong)",
                    flexShrink: 0,
                  }}
                />
              )}

              <span
                className="ty-caption2"
                style={{
                  color: "var(--color-primary-text)",
                  fontWeight: "var(--font-weight-bold)",
                  width: 44,
                  flexShrink: 0,
                }}
              >
                {h.time}
              </span>

              <span
                style={{
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--color-text-primary)",
                  flex: 1,
                  minWidth: 80,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={h.filename}
              >
                {h.title}
              </span>

              {[h.sizeLabel, h.layoutName, h.themeName, `${h.format.toUpperCase()} ${h.scale}x`].map((tag, idx) => (
                <span
                  key={idx}
                  className="ty-caption2"
                  style={{
                    padding: "2px 8px",
                    background: "var(--color-tag-bg)",
                    borderRadius: "var(--radius-xs)",
                    color: "var(--color-text-secondary)",
                    fontWeight: "var(--font-weight-medium)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tag}
                </span>
              ))}

              <button
                onClick={() => onRestore?.(h)}
                className="ty-caption1"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-secondary)",
                  fontWeight: "var(--font-weight-medium)",
                  whiteSpace: "nowrap",
                }}
                title="이 배너의 설정을 다시 불러옵니다"
              >
                설정 복원
              </button>
              <button
                onClick={() => onDownload?.(h)}
                className="ty-caption1"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary-text)",
                  fontWeight: "var(--font-weight-bold)",
                  whiteSpace: "nowrap",
                }}
              >
                다운로드
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
