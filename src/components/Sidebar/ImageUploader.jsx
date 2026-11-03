import { useEffect, useRef, useState } from "react";

import SidebarSection, { FieldLabel } from "../ui/SidebarSection";
import Segmented from "../ui/Segmented";
import Toggle from "../ui/Toggle";
import RegionSelector from "../Image/RegionSelector";
import { BG_PROVIDERS } from "../../lib/removeBackground";

/**
 * ImageUploader — 배경 이미지
 *
 * 기본 화면은 업로드 · 미리보기 · 채우기 방식만 보인다. 배경 제거는 "꼭 필요할 때만" 쓰는 기능이라
 * [배경 제거] 를 눌렀을 때 비로소 방식 선택 · 남길 영역 · 실행 CTA 가 펼쳐진다.
 * (처음부터 펼쳐 두면 업로드할 때마다 누끼를 따야 하는 것처럼 읽혔다)
 */

const FIT_OPTIONS = [
  { id: "cover", label: "꽉 채우기", desc: "캔버스를 가득 채우고 넘치는 부분은 잘림 (사진 배경)" },
  { id: "contain", label: "전체 보기", desc: "이미지 전체가 보이도록 축소 (누끼 상품컷)" },
];

/* DS Button md (outlined) — 높이 40 · r10 · label2.
   패널 폭을 꽉 채우는 동작 버튼은 같은 칸의 입력·세그먼트(40)와 높이를 맞춘다. */
const outlineButton = {
  width: "100%",
  height: "var(--control-height-md)",
  padding: "0 20px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  color: "var(--color-text-primary)",
  fontSize: "var(--font-label2-size)",
  lineHeight: "var(--font-label2-line)",
  letterSpacing: "var(--font-label2-ls)",
  fontWeight: "var(--font-weight-bold)",
  marginBottom: 8,
};

/* DS SectionMessage 톤 — 상태별 background-status / accent-foreground 쌍 */
const notice = (tone) => ({
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  background: tone === "error" ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
  color: tone === "error" ? "var(--color-danger-text)" : "var(--color-warning-text)",
  fontSize: "var(--font-caption2-size)",
  letterSpacing: "var(--font-caption2-ls)",
  lineHeight: 1.5,
  marginBottom: 8,
});

/** 선택 상태 한 줄 요약 */
function describeSelection(selection) {
  if (!selection) return null;
  if (selection.type === "mask") {
    const b = selection.bounds;
    return b ? `빠른 선택 · 범위 ${Math.round(b.w * 100)}% × ${Math.round(b.h * 100)}%` : "빠른 선택";
  }
  const r = selection.region;
  return `사각형 · ${Math.round(r.w * 100)}% × ${Math.round(r.h * 100)}%`;
}

export default function ImageUploader({
  image,
  onUpload,
  onChange,
  onRemoveBackground,
  onRevertCutout,
  onClear,
  provider,
  onProviderChange,
  status,
  // 퀵 메뉴처럼 제품 누끼가 기본인 지면 — 이미지를 올리면 배경 제거 패널을 바로 펼친다
  suggestCutout = false,
  // 배경색 행 (ColorField) — 배경 섹션 맨 위에 둔다
  colorControl = null,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);

  useEffect(() => {
    if (suggestCutout && image?.src && !image.cutoutSrc) setBgOpen(true);
  }, [suggestCutout, image?.src, image?.cutoutSrc]);

  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setBgOpen(false);
    onUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const activeProvider = BG_PROVIDERS.find((p) => p.id === provider);
  const running = status?.running;
  const selection = image?.selection || (image?.region ? { type: "rect", region: image.region } : null);
  const selectionText = describeSelection(selection);

  return (
    <SidebarSection title="배경">
      {/* 배경색 — 이미지 아래에 깔리는 색 (누끼·투명 영역에서 보인다) */}
      {colorControl && <div style={{ marginBottom: 12 }}>{colorControl}</div>}
      <FieldLabel>이미지</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />

      {!image?.src ? (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          /* 업로드 박스는 원본 빌더(5173)의 그레이 박스 그대로 — 면 #FAFAFB 에
             2px dashed 테두리, 라운드 10, 세로 여백 22. 끌어다 놓는 중일 때만
             포인트 컬러로 바뀐다. */
          style={{
            width: "100%",
            padding: "22px 12px",
            borderRadius: "var(--radius-md)",
            border: `2px dashed ${dragOver ? "var(--color-primary)" : "var(--color-border)"}`,
            background: dragOver ? "var(--color-primary-light)" : "var(--legacy-upload-bg)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-caption1-size)",
            lineHeight: 1.6,
            fontWeight: "var(--font-weight-bold)",
          }}
        >
          <div className="ty-heading2" style={{ marginBottom: 6 }}>+</div>
          이미지를 드래그하거나 클릭해 업로드
          <div className="ty-caption2" style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-medium)", marginTop: 4 }}>
            PNG · JPG · WEBP
          </div>
        </button>
      ) : (
        <>
          {/* 미리보기 — 눌러서 다른 이미지로 교체 */}
          <div
            className="preview-checker"
            onClick={() => inputRef.current?.click()}
            title="눌러서 다른 이미지로 교체"
            style={{
              position: "relative",
              width: "100%",
              height: 112,
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <img
              src={image.useCutout && image.cutoutSrc ? image.cutoutSrc : image.src}
              alt={image.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
            {image.cutoutSrc && (
              <span
                className="ty-caption2"
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                  background: image.useCutout ? "var(--color-success)" : "var(--semantic-inverse-background)",
                  color: "var(--semantic-static-white)",
                  fontWeight: "var(--font-weight-bold)",
                }}
              >
                {image.useCutout ? "배경 제거됨" : "원본 표시 중"}
              </span>
            )}
          </div>

          <div
            className="ty-caption2"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              color: "var(--color-text-muted)",
              marginBottom: 12,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{image.name}</span>
            <button
              onClick={onClear}
              className="ty-caption2"
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-secondary)",
                fontWeight: "var(--font-weight-bold)",
                flexShrink: 0,
              }}
            >
              이미지 삭제
            </button>
          </div>

          {/* 채우기 방식 */}
          <FieldLabel>채우기</FieldLabel>
          <div style={{ marginBottom: 12 }}>
            <Segmented
              options={FIT_OPTIONS}
              value={image.fit || "cover"}
              onChange={(id) => onChange({ fit: id })}
              ariaLabel="배경 채우기"
            />
          </div>

          {/* 누끼 결과가 있을 때만 — 사용 여부 / 되돌리기 */}
          {image.cutoutSrc && (
            <div style={{ marginBottom: 8 }}>
              <Toggle
                checked={Boolean(image.useCutout)}
                onChange={() => onChange({ useCutout: !image.useCutout })}
                label="배경 제거 이미지 사용"
              />
              <button onClick={onRevertCutout} style={{ ...outlineButton, marginTop: 8 }}>
                배경 제거 취소 (원본으로)
              </button>
            </div>
          )}

          {/* 배경 제거 — 누를 때만 펼친다 */}
          {!bgOpen ? (
            <button onClick={() => setBgOpen(true)} style={outlineButton}>
              {image.cutoutSrc ? "배경 다시 제거" : "배경 제거"}
            </button>
          ) : (
            <div
              style={{
                borderRadius: "var(--radius-lg)",
                padding: 16,
                marginBottom: 8,
                background: "var(--color-surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="ty-label2" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)" }}>
                  배경 제거
                </span>
                <button
                  onClick={() => setBgOpen(false)}
                  aria-label="배경 제거 닫기"
                  className="ty-body1"
                  style={{ background: "none", border: "none", color: "var(--color-text-muted)", padding: 0 }}
                >
                  ×
                </button>
              </div>

              {suggestCutout && (
                <div
                  className="ty-caption2"
                  style={{ color: "var(--color-primary-text)", fontWeight: "var(--font-weight-medium)", lineHeight: 1.5, marginBottom: 8 }}
                >
                  퀵 메뉴는 제품만 남기고 배경을 지워 그레이 타일 위에 올립니다.
                </div>
              )}
              {/* DS Select — TextField 와 같은 라운드(12)·면(fill) */}
              <select
                value={provider}
                onChange={(e) => onProviderChange(e.target.value)}
                title={activeProvider?.hint}
                className="ty-label2"
                style={{
                  width: "100%",
                  height: "var(--control-height-md)",
                  padding: "0 12px",
                  borderRadius: "var(--radius-lg)",
                  border: "none",
                  background: "var(--color-fill)",
                  marginBottom: 8,
                }}
              >
                {BG_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available()}>
                    {p.name} — {p.desc}
                    {p.available() ? "" : " (미설정)"}
                  </option>
                ))}
              </select>

              {provider === "region" ? (
                <>
                  <button onClick={() => setRegionOpen(true)} style={outlineButton}>
                    {selection ? "남길 영역 다시 선택" : "남길 영역 선택 (빠른 선택 · 사각형)"}
                  </button>
                  <div
                    className="ty-caption2"
                    style={{
                      color: selection ? "var(--color-primary-text)" : "var(--color-text-muted)",
                      fontWeight: selection ? "var(--font-weight-bold)" : "var(--font-weight-regular)",
                      marginBottom: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    {selectionText || "선택하지 않으면 이미지 테두리와 같은 색의 배경만 지웁니다."}
                  </div>
                </>
              ) : (
                <div className="ty-caption2" style={{ color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 8 }}>
                  {activeProvider?.hint}
                </div>
              )}

              <button
                onClick={onRemoveBackground}
                disabled={running}
                className="ty-label2"
                style={{
                  width: "100%",
                  height: "var(--control-height-md)",
                  padding: "0 20px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: running ? "var(--color-disable-bg)" : "var(--color-primary)",
                  color: running ? "var(--color-text-disable)" : "var(--color-on-primary)",
                  fontWeight: "var(--font-weight-bold)",
                  cursor: running ? "wait" : "pointer",
                }}
              >
                {running ? `${status.label}…` : "배경 제거 실행"}
              </button>

              {running && (
                <div
                  style={{
                    height: 4,
                    background: "var(--color-fill-strong)",
                    borderRadius: "var(--radius-full)",
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round((status.ratio || 0) * 100)}%`,
                      height: "100%",
                      background: "var(--color-primary)",
                      transition: "width 0.2s",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {status?.error && <div style={notice("error")}>{status.error}</div>}
          {status?.warning && !status?.error && <div style={notice("warn")}>{status.warning}</div>}

          <div className="ty-caption2" style={{ color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            위치·크기는 아래 "이미지 조정" 에서 바꿉니다. 이미지는 어떤 템플릿에서든 배경으로 합성됩니다.
          </div>
        </>
      )}

      {regionOpen && (
        <RegionSelector
          src={image.src}
          initialSelection={selection}
          onCancel={() => setRegionOpen(false)}
          onApply={(next) => {
            onChange({ selection: next, region: next.type === "rect" ? next.region : null });
            setRegionOpen(false);
          }}
        />
      )}
    </SidebarSection>
  );
}
