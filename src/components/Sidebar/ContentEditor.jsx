import SidebarSection, { FieldLabel } from "../ui/SidebarSection";

const FIELDS = [
  { key: "eventTag", label: "이벤트 태그", placeholder: "EVENT, SALE, NEW...", type: "input" },
  { key: "titleLead", label: "타이틀 윗줄 (Regular)", placeholder: "컬리와 함께하는", type: "input" },
  { key: "title", label: "메인 타이틀 (Bold)", placeholder: "9월의 결제 혜택", type: "input" },
  { key: "subtitle", label: "서브 카피", placeholder: "혜택 설명 문구", type: "textarea" },
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

// colors: 이 템플릿에서 쓰는 글자·태그·CTA 색 행들 (ColorField) — 드롭다운 없이 한 줄씩 고친다
export default function ContentEditor({ content, onChange, colors = null }) {
  return (
    <SidebarSection title="콘텐츠 입력">
      {FIELDS.map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <label
            className="ty-caption1"
            style={{
              fontWeight: "var(--font-weight-medium)",
              color: "var(--color-text-secondary)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {f.label}
          </label>
          {f.type === "textarea" ? (
            <textarea
              value={content[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
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
