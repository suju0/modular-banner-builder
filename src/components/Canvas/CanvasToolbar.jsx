import { EXPORT_FORMATS, EXPORT_SCALES } from "../../lib/exportImage";
import Segmented from "../ui/Segmented";

/**
 * DS Button sm — 라운드 8 · 패딩 7/14 · label2.
 * 비활성은 투명도를 깎지 않고 DS 가 가진 상태 토큰(interaction-disable + label-disable)으로
 * 표현한다. opacity 로 흐리면 바탕이 비쳐 색이 제각각이 된다.
 */
const actionButton = (variant, disabled) => {
  const solid = variant === "solid";
  return {
    height: "var(--control-height-sm)",
    padding: "0 14px",
    borderRadius: "var(--radius-sm)",
    fontSize: "var(--font-label2-size)",
    lineHeight: "var(--font-label2-line)",
    letterSpacing: "var(--font-label2-ls)",
    fontWeight: "var(--font-weight-bold)",
    border: solid ? "none" : `1px solid ${disabled ? "var(--color-border)" : "var(--color-border-strong)"}`,
    background: disabled
      ? "var(--color-disable-bg)"
      : solid
        ? "var(--color-primary)"
        : "var(--color-card)",
    color: disabled
      ? "var(--color-text-disable)"
      : solid
        ? "var(--color-on-primary)"
        : "var(--color-text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  };
};

const labelledControl = { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 };

const controlLabel = {
  fontWeight: "var(--font-weight-medium)",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
};

export default function CanvasToolbar({
  editMode,
  onEditModeChange,
  imageAvailable,
  movedCount,
  onResetOffsets,
  onResetTransform,
  transformChanged,
  format,
  onFormatChange,
  scale,
  onScaleChange,
  outputSize,
  indicatorAvailable,
  showIndicator,
  onToggleIndicator,
}) {
  const toggle = (mode) => onEditModeChange(editMode === mode ? "none" : mode);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "12px 20px",
        background: "var(--color-card)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <button
        onClick={() => toggle("slots")}
        title="캔버스에서 모듈을 드래그해 위치를 미세 조정합니다"
        style={actionButton(editMode === "slots" ? "solid" : "outline", false)}
      >
        {editMode === "slots" ? "위치 편집 ON" : "위치 편집"}
      </button>

      <button
        onClick={() => toggle("image")}
        disabled={!imageAvailable}
        title={
          imageAvailable
            ? "8개 핸들·드래그·휠로 배경 이미지의 위치와 크기를 조정합니다"
            : "배경 이미지를 업로드하면 사용할 수 있습니다"
        }
        style={actionButton(editMode === "image" ? "solid" : "outline", !imageAvailable)}
      >
        {editMode === "image" ? "이미지 조정 ON" : "이미지 조정"}
      </button>

      <button
        onClick={onResetOffsets}
        disabled={movedCount === 0}
        style={actionButton("outline", movedCount === 0)}
        title="옮긴 텍스트 위치와 정렬을 템플릿 기본값으로 되돌립니다"
      >
        위치 초기화{movedCount > 0 ? ` (${movedCount})` : ""}
      </button>

      <button
        onClick={onResetTransform}
        disabled={!transformChanged}
        style={actionButton("outline", !transformChanged)}
        title="배경 이미지의 위치·크기·채우기를 템플릿 기본값으로 되돌립니다"
      >
        이미지 초기화
      </button>

      {/* 캐러셀이 있는 지면은 앱 홈 메인 배너(1125×840) 하나뿐이라 그때만 노출한다 */}
      {indicatorAvailable && (
        <button
          onClick={onToggleIndicator}
          title="캐러셀 인디케이터는 미리보기에만 표시되며 내려받는 배너 이미지에는 포함되지 않습니다"
          style={actionButton(showIndicator ? "solid" : "outline", false)}
        >
          {showIndicator ? "인디케이터 표시 ON" : "인디케이터 표시"}
        </button>
      )}

      <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />

      {/* 라벨과 컨트롤은 한 덩어리로 묶는다 — 줄바꿈될 때 둘이 갈라지면
          "포맷" 만 윗줄에 남아 어느 컨트롤의 이름인지 읽히지 않는다 */}
      <div style={labelledControl}>
        <span className="ty-caption1" style={controlLabel}>포맷</span>
        <Segmented options={EXPORT_FORMATS} value={format} onChange={onFormatChange} size="sm" inline ariaLabel="내보내기 포맷" />
      </div>

      <div style={labelledControl}>
        <span className="ty-caption1" style={controlLabel}>배율</span>
        <Segmented options={EXPORT_SCALES} value={scale} onChange={onScaleChange} size="sm" inline ariaLabel="내보내기 배율" />
      </div>

      <div style={{ flex: 1 }} />

      <span className="ty-caption1" style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-medium)" }}>
        결과물 {outputSize.w} × {outputSize.h}px
      </span>
    </div>
  );
}
