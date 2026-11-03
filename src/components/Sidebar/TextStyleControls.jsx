import { useEffect, useRef, useState } from "react";

import { TAG_STYLES, TEXT_WEIGHTS } from "../../constants/layouts";
import SidebarSection, { FieldLabel } from "../ui/SidebarSection";
import Segmented from "../ui/Segmented";

/**
 * TextStyleControls
 *
 * 레이아웃은 텍스트의 "수직 구성"만 정의하고, 배치·정렬·스타일은 여기서 정한다.
 *
 * 배치 UI 는 Figma 의 Design 패널을 따랐다.
 *   1) 정렬(Alignment) — 좌/가로중앙/우 + 상/세로중앙/하 아이콘 버튼
 *   2) 위치(Position)  — X / Y 를 배너 좌표(px)로 직접 입력
 * Figma 와 같이 정렬은 "모드"가 아니라 **한 번 누르면 옮기는 동작**이고,
 * 지금 어디에 있는지는 아래 X / Y 값이 알려 준다.
 *
 * 대상은 위치 편집 모드에서 고른 슬롯 하나, 고르지 않았으면 텍스트 블록 전체다.
 * "글줄 정렬"은 별개다 — 박스를 옮기는 게 아니라 박스 안에서 글줄을 맞춘다.
 */

const labelStyle = {
  fontSize: "var(--font-caption1-size)",
  lineHeight: "var(--font-caption1-line)",
  letterSpacing: "var(--font-caption1-ls)",
  fontWeight: "var(--font-weight-medium)",
  color: "var(--color-text-muted)",
  marginBottom: 8,
  display: "block",
};

const hintStyle = {
  fontSize: "var(--font-caption2-size)",
  lineHeight: 1.5,
  letterSpacing: "var(--font-caption2-ls)",
  color: "var(--color-text-muted)",
  marginTop: 6,
};

/* ------------------------------ 아이콘 ------------------------------ */

/**
 * 16×16 그리드에서 좌우/상하 여백을 같게 잡아 그린다.
 *
 *   기준선   : 가장자리에서 2.2 (round cap 두께를 감안한 값)
 *   막대     : 두께 2.4 / rx 1.2 — 글줄 정렬 아이콘의 둥근 선과 같은 톤
 *   막대 길이 : 8.8 / 5.6 (길고 짧은 두 줄)
 *
 * 여섯 방향을 개별 좌표로 적으면 비율이 어긋나기 쉬워서 한 규칙에서 생성한다.
 */
const svgProps = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none" };
const guideProps = { stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" };
const barProps = { fill: "currentColor", rx: 1.2 };

const NEAR = 2.2; // 기준선 쪽 끝
const FAR = 13.8; // 반대쪽 끝
const GAP = 2.2; // 기준선과 막대 사이
const THICK = 2.4;
const LONG = 8.8;
const SHORT = 5.6;
const OFF_LONG = 4.8; // 교차축에서 긴 막대 위치
const OFF_SHORT = 8.8; // 짧은 막대

/** 객체 정렬 아이콘 — 기준선 1개 + 길이가 다른 막대 2개 (Figma 아이콘 구조) */
function AlignIcon({ kind }) {
  const [axis, mode] = kind.split("-");
  const horizontal = axis === "x";
  const at = mode === "start" ? NEAR : mode === "end" ? FAR : 8;

  const guide = horizontal
    ? { x1: at, y1: NEAR, x2: at, y2: FAR }
    : { x1: NEAR, y1: at, x2: FAR, y2: at };

  // 막대는 기준선에 붙는 쪽을 맞추고 반대쪽으로 자란다
  const head = (len) =>
    mode === "start" ? NEAR + GAP : mode === "end" ? FAR - GAP - len : (16 - len) / 2;

  const bar = (len, offset) =>
    horizontal
      ? { x: head(len), y: offset, width: len, height: THICK }
      : { x: offset, y: head(len), width: THICK, height: len };

  return (
    <svg {...svgProps}>
      <line {...guide} {...guideProps} />
      <rect {...bar(LONG, OFF_LONG)} {...barProps} />
      <rect {...bar(SHORT, OFF_SHORT)} {...barProps} />
    </svg>
  );
}

/** 글줄 정렬 아이콘 — 길이가 엇갈리는 네 줄 */
const TEXT_ALIGN_LINES = {
  left: [
    [NEAR, FAR],
    [NEAR, 10.2],
    [NEAR, FAR],
    [NEAR, 10.2],
  ],
  center: [
    [NEAR, FAR],
    [3.8, 12.2],
    [NEAR, FAR],
    [3.8, 12.2],
  ],
  right: [
    [NEAR, FAR],
    [5.8, FAR],
    [NEAR, FAR],
    [5.8, FAR],
  ],
};

function TextAlignIcon({ kind }) {
  return (
    <svg {...svgProps}>
      {TEXT_ALIGN_LINES[kind].map(([x1, x2], i) => (
        <line key={i} x1={x1} y1={3.4 + i * 3.07} x2={x2} y2={3.4 + i * 3.07} {...guideProps} />
      ))}
    </svg>
  );
}

/* ------------------------------ 버튼 ------------------------------ */

/* 아이콘 토글 — SegmentedControl sm 의 트랙/아이템 규격(32 / r8·r6)을 따른다 */
const iconButton = (active, disabled) => ({
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-xs)",
  border: "none",
  background: active ? "var(--color-primary-light)" : "transparent",
  color: disabled
    ? "var(--color-text-disable)"
    : active
      ? "var(--color-primary-text)"
      : "var(--color-text-secondary)",
  cursor: disabled ? "not-allowed" : "pointer",
});

const groupStyle = {
  display: "flex",
  width: "fit-content",
  gap: 2,
  padding: 2,
  borderRadius: "var(--radius-sm)",
  background: "var(--color-fill)",
};

const ALIGN_BUTTONS = [
  { axis: "x", mode: "start", kind: "x-start", title: "좌측 정렬" },
  { axis: "x", mode: "center", kind: "x-center", title: "가로 중앙 정렬" },
  { axis: "x", mode: "end", kind: "x-end", title: "우측 정렬" },
  { axis: "y", mode: "start", kind: "y-start", title: "상단 정렬" },
  { axis: "y", mode: "center", kind: "y-center", title: "세로 중앙 정렬" },
  { axis: "y", mode: "end", kind: "y-end", title: "하단 정렬" },
];

/* --------------------------- 숫자 입력 --------------------------- */

function NumberField({ prefix, value, onCommit, disabled }) {
  const [draft, setDraft] = useState("");
  // 마지막으로 확정한 입력값. Enter 로 확정한 뒤 blur 가 같은 값을 또 보내면
  // 한 번 옮긴 거리만큼 더 옮겨져(측정이 아직 갱신 전이라) 입력값과 어긋났다
  const committedRef = useRef(null);

  // 드래그·정렬로 값이 바뀌면 입력창도 따라간다 (편집 중이 아닐 때만 의미가 있다)
  useEffect(() => {
    setDraft(value == null ? "" : String(Math.round(value)));
    committedRef.current = null;
  }, [value]);

  const commit = () => {
    const shown = value == null ? "" : String(Math.round(value));
    // 바뀐 게 없거나 방금 확정한 값이면 보내지 않는다
    if (draft === shown || draft === committedRef.current) return;
    const n = parseFloat(draft);
    if (Number.isFinite(n)) {
      committedRef.current = draft;
      onCommit(n);
    } else setDraft(shown);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // blur() 로 흘려보내지 않고 여기서 확정한다 — 포커스가 그대로 남는
      // 환경에서도 Enter 는 값이 들어가야 한다
      commit();
      e.currentTarget.blur();
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const n = parseFloat(draft);
    if (!Number.isFinite(n)) return;
    onCommit(n + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
  };

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
        height: "var(--control-height-md)",
        padding: "0 12px",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-fill)",
        border: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="ty-caption2" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-text-muted)" }}>
        {prefix}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="ty-caption1"
        style={{
          width: "100%",
          minWidth: 0,
          border: "none",
          background: "none",
          fontWeight: "var(--font-weight-medium)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family)",
          padding: 0,
        }}
      />
    </div>
  );
}

/* ------------------------------ 본체 ------------------------------ */

function OptionRow({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <FieldLabel>{label}</FieldLabel>
      <Segmented options={options} value={value} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

/* ------------------------------ Format ------------------------------ */




/**
 * "텍스트" 카드 (정렬 · 위치 · 폰트 두께 · 이벤트 태그 표현) — 지금은 숨김.
 *
 * 색상은 "콘텐츠 입력" 카드로 옮겼고, 슬롯 위치는 캔버스 툴바의 "위치 편집"에서
 * 드래그·방향키로 조정한다. 다시 꺼내려면 아래 hidden 을 false 로 바꾸면 된다
 * (BannerBuilder 가 이 값을 보고 렌더 여부를 정한다).
 */
export const TEXT_SECTION = { hidden: true };

export default function TextStyleControls({
  align,
  onAlignChange,
  // 폰트 두께 — 전역 프리셋. 렌더러가 getTextWeights 로 읽는다
  weight,
  onWeightChange,
  tagStyle,
  onTagStyleChange,
  box,
  onAlign,
  onPositionChange,
  targetLabel,
  targetIsBlock,
  onClearSelection,
  // 이 섹션에서 쓰는 글자·태그·CTA 색 행들 (ColorField) — 드롭다운 없이 한 줄씩 바로 고친다
  colors = null,
  showTagStyle = true,
}) {
  const disabled = !box;

  return (
    <SidebarSection title="텍스트">
      {/* 대상 표시 — Figma 의 선택 레이어 이름 자리 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span className="ty-label2" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)" }}>
          {targetLabel}
        </span>
        {!targetIsBlock && (
          <button
            onClick={onClearSelection}
            className="ty-caption2"
            style={{
              border: "none",
              background: "none",
              fontWeight: "var(--font-weight-bold)",
              color: "var(--color-primary-text)",
            }}
          >
            블록 전체
          </button>
        )}
      </div>

      {/* 1) 정렬 + 글줄 정렬 — Figma 처럼 한 줄에 나란히 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>정렬</label>
          <div style={groupStyle}>
            {ALIGN_BUTTONS.map((b) => (
              <button
                key={b.kind}
                onClick={() => onAlign(b.axis, b.mode)}
                disabled={disabled}
                title={b.title}
                style={iconButton(false, disabled)}
              >
                <AlignIcon kind={b.kind} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>글줄 정렬</label>
          <div style={groupStyle}>
            {["left", "center", "right"].map((id) => (
              <button
                key={id}
                onClick={() => onAlignChange(id)}
                title={
                  { left: "글줄 왼쪽 맞춤", center: "글줄 가운데 맞춤", right: "글줄 오른쪽 맞춤" }[
                    id
                  ]
                }
                style={iconButton(align === id, false)}
              >
                <TextAlignIcon kind={id} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2) 위치 */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>위치</label>
        <div style={{ display: "flex", gap: 8 }}>
          <NumberField
            prefix="X"
            value={box?.x}
            disabled={disabled}
            onCommit={(v) => onPositionChange("x", v)}
          />
          <NumberField
            prefix="Y"
            value={box?.y}
            disabled={disabled}
            onCommit={(v) => onPositionChange("y", v)}
          />
        </div>
        <div style={hintStyle}>
          {box
            ? `배너 좌상단 기준 px · 선택 영역 ${Math.round(box.w)} × ${Math.round(box.h)}`
            : "표시할 텍스트 모듈이 없습니다."}
        </div>
      </div>

      {/* 폰트 두께 — 전역 프리셋 (렌더러가 getTextWeights 로 읽는다) */}
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>폰트 두께</FieldLabel>
        <Segmented
          options={TEXT_WEIGHTS}
          value={weight}
          onChange={onWeightChange}
          ariaLabel="폰트 두께"
        />
      </div>

      {/* 색상 — 지금 템플릿에서 쓰는 역할만 */}
      {colors && (
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>색상</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{colors}</div>
        </div>
      )}

      {showTagStyle && (
        <OptionRow
          label="이벤트 태그 표현"
          options={TAG_STYLES}
          value={tagStyle}
          onChange={onTagStyleChange}
        />
      )}
    </SidebarSection>
  );
}
