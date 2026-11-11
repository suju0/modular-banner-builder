import { useEffect, useState } from "react";

import SidebarSection, { FieldLabel } from "../ui/SidebarSection";
import { MAX_TITLE_LINES, clampTitle, resetTitleFitCache, titleLineCounts } from "../../lib/titleFit";

// 메인 타이틀은 한 칸에 줄바꿈으로 쓴다 (2줄까지).
// 줄당 글자 수는 고정이 아니라 지금 고른 규격·템플릿에서 재서 정한다 — lib/titleFit.
const FIELDS = [
  { key: "eventTag", label: "이벤트 태그 · 브랜드명", placeholder: "EVENT, SALE, NEW...", type: "input" },
  {
    key: "title",
    label: "메인 타이틀",
    placeholder: "컬리와 함께하는\n9월의 결제 혜택",
    type: "textarea",
    rows: 2,
    limited: true,
  },
  { key: "subtitle", label: "서브 타이틀", placeholder: "혜택 설명 문구", type: "textarea" },
  { key: "discount", label: "할인 정보", placeholder: "UP TO 50% OFF", type: "input" },
  { key: "date", label: "기간", placeholder: "09.01 - 09.07", type: "input" },
  { key: "cta", label: "CTA 문구", placeholder: "지금 바로 가입하고 혜택 받기", type: "input" },
];

/* DS TextField — 라운드 12, 가로 패딩 12. 높이는 height prop 이 있는 컴포넌트라
   패널에 맞춰 md(40px)로 고정한다. 테두리 없이 fill 로만 구분. */
const inputStyle = {
  width: "100%",
  height: "var(--control-height-md)",
  padding: "0 12px",
  borderRadius: "var(--radius-lg)",
  border: "none",
  background: "var(--color-fill)",
  fontSize: "var(--font-label2-size)",
  lineHeight: "var(--font-label2-line)",
  letterSpacing: "var(--font-label2-ls)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle = {
  fontWeight: "var(--font-weight-medium)",
  color: "var(--color-text-secondary)",
  display: "block",
};

/**
 * 타이틀 입력 — 2줄·줄당 폭을 넘기면 **그 입력이 들어가지 않는다.**
 *
 * 오류로 알리지 않는다. 대신 배달 앱 요청사항처럼 줄마다 "쓴 글자/상한" 을 띄워,
 * 한도에 닿았다는 걸 숫자로만 보여 준다.
 */
function TitleField({ value, onChange, placeholder, bannerSize, layout }) {
  // 폰트가 늦게 뜨면 폭 측정이 틀어진다. 로드가 끝나면 캐시를 비우고 한 번 다시 센다.
  const [, setFontTick] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      resetTitleFitCache();
      setFontTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  const counts = titleLineCounts(value, bannerSize, layout);
  const atLineCap = counts.length >= MAX_TITLE_LINES;

  const handleChange = (next) => {
    const { value: clamped } = clampTitle(next, bannerSize, layout);
    if (clamped !== value) onChange(clamped);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <label className="ty-caption1" style={labelStyle}>
          메인 타이틀 <span style={{ color: "var(--color-text-muted)" }}>(Enter 로 줄바꿈)</span>
        </label>
        <span
          className="ty-caption2"
          style={{
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            fontWeight: atLineCap ? "var(--font-weight-bold)" : "var(--font-weight-regular)",
            color: atLineCap ? "var(--color-primary-text)" : "var(--color-text-muted)",
          }}
        >
          {counts.length}/{MAX_TITLE_LINES}줄
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          // 3번째 줄은 아예 만들지 않는다 — 줄이 늘면 서브 타이틀과 겹친다
          if (e.key === "Enter" && String(value).split("\n").length >= MAX_TITLE_LINES) {
            e.preventDefault();
          }
        }}
        placeholder={placeholder}
        rows={MAX_TITLE_LINES}
        style={{ ...inputStyle, height: "auto", padding: "10px 12px", resize: "vertical" }}
      />

      {/* 줄별 글자 수 — 상한에 닿으면 숫자만 포인트 컬러로 바뀐다 (오류 아님) */}
      <div
        className="ty-caption2"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "2px 10px",
          marginTop: 6,
          color: "var(--color-text-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {counts.map((c, i) => {
          const full = c.used >= c.max;
          return (
            <span key={i}>
              {i + 1}줄{" "}
              <b
                style={{
                  fontWeight: full ? "var(--font-weight-bold)" : "var(--font-weight-regular)",
                  color: full ? "var(--color-primary-text)" : "var(--color-text-secondary)",
                }}
              >
                {c.used}/{c.max}
              </b>
            </span>
          );
        })}
      </div>
    </>
  );
}

// colors: 이 템플릿에서 쓰는 글자·태그·CTA 색 행들 (ColorField) — 드롭다운 없이 한 줄씩 고친다
export default function ContentEditor({ content, onChange, colors = null, bannerSize, layout }) {
  return (
    <SidebarSection title="콘텐츠 입력">
      {FIELDS.map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          {f.limited && bannerSize && layout ? (
            <TitleField
              value={content[f.key] ?? ""}
              onChange={(next) => onChange(f.key, next)}
              placeholder={f.placeholder}
              bannerSize={bannerSize}
              layout={layout}
            />
          ) : (
            <>
              <label className="ty-caption1" style={{ ...labelStyle, marginBottom: 6 }}>
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={content[f.key]}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={f.rows ?? 2}
                  style={{ ...inputStyle, height: "auto", padding: "10px 12px", resize: "vertical" }}
                />
              ) : (
                <input
                  value={content[f.key]}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={inputStyle}
                />
              )}
            </>
          )}
        </div>
      ))}
      {colors && (
        <div style={{ marginTop: 8 }}>
          <FieldLabel>색상</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{colors}</div>
        </div>
      )}
    </SidebarSection>
  );
}
