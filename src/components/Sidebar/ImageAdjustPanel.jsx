import { useState } from "react";

import { EXPAND_DIRECTIONS, EXPAND_METHODS } from "../../lib/imageExpand";
import { MAX_CARVE_RATIO } from "../../lib/seamCarve";
import {
  DEFAULT_TRANSFORM,
  MAX_SCALE,
  MIN_SCALE,
  computeImageLayout,
  resolveImageSource,
} from "../../lib/imageTransform";
import SidebarSection, { FieldLabel } from "../ui/SidebarSection";

/**
 * ImageAdjustPanel
 *
 * 기본 화면은 자주 쓰는 것만 둔다 — 직접 조정 토글 · 크기 · 정렬 · 여백 · 초기화.
 *   정렬 : Borders 패널처럼 점선 사각형 5칸(위·왼쪽·가운데·오른쪽·아래). 누르면 그 변을 캔버스 변에 붙인다.
 *   여백 : 이미지 각 변에서 캔버스 변까지 거리(px) 4칸 — 값을 넣으면 그 변이 정확히 그 거리에 온다.
 * 큰 이동은 미리보기에서 드래그하는 편이 빠르다.
 * 배경 확장 · 내용 인식 비율 같은 파괴적 편집은 "고급 편집" 안에 접어 둔다.
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

/* DS Chip md — r8. 켜진 상태는 primary 계열 면/글자 */
const chipButton = (active) => ({
  flex: 1,
  height: "var(--control-height-sm)",
  padding: "0 8px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: active ? "var(--color-primary-light)" : "var(--color-fill)",
  color: active ? "var(--color-primary-text)" : "var(--color-text-secondary)",
  fontSize: "var(--font-caption1-size)",
  lineHeight: "var(--font-caption1-line)",
  letterSpacing: "var(--font-caption1-ls)",
  fontWeight: "var(--font-weight-bold)",
});

/* DS Button md — 높이 40 · r10 · label2. 비활성은 상태 토큰으로.
   패널 폭을 꽉 채우는 동작 버튼은 같은 칸의 입력·세그먼트(40)와 높이를 맞춘다. */
const actionButton = (variant, disabled) => {
  const solid = variant === "solid";
  return {
    width: "100%",
    height: "var(--control-height-md)",
    padding: "0 20px",
    borderRadius: "var(--radius-md)",
    border: solid ? "none" : `1px solid ${disabled ? "var(--color-border)" : "var(--color-border-strong)"}`,
    background: disabled ? "var(--color-disable-bg)" : solid ? "var(--color-primary)" : "var(--color-card)",
    color: disabled ? "var(--color-text-disable)" : solid ? "var(--color-on-primary)" : "var(--color-text-primary)",
    fontSize: "var(--font-label2-size)",
    lineHeight: "var(--font-label2-line)",
    letterSpacing: "var(--font-label2-ls)",
    fontWeight: "var(--font-weight-bold)",
    marginBottom: 8,
    cursor: disabled ? "not-allowed" : "pointer",
  };
};

/* DS SectionMessage 톤 */
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

/**
 * [접두어][숫자][단위] 한 칸 입력 — Figma 의 X/Y/W 입력처럼 쓴다.
 * 값은 % 정수. ↑↓ 1, Shift+↑↓ 10. 입력 중에는 로컬 문자열을 두고 Enter/blur 에 확정한다.
 */
function PercentField({ prefix, value, onChange, min = -200, max = 200 }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? String(value);
  const commit = (next) => {
    const n = Math.round(Number(next));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };

  return (
    <label
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        height: "var(--control-height-sm)",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: "var(--color-fill)",
      }}
    >
      <span className="ty-caption2" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-text-muted)" }}>
        {prefix}
      </span>
      <input
        value={shown}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(shown);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
            commit(Number(shown) + step);
          }
        }}
        className="ty-caption1"
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          background: "transparent",
          fontWeight: "var(--font-weight-medium)",
          fontVariantNumeric: "tabular-nums",
          padding: 0,
        }}
      />
      <span className="ty-caption2" style={{ color: "var(--color-text-muted)" }}>%</span>
    </label>
  );
}

/* ------------------------------ 정렬 패드 ------------------------------ */

/** 점선 사각형 + 한 변만 실선 (Borders 패널 아이콘). side: top|left|right|bottom|center */
function EdgeIcon({ side, size = 18 }) {
  const dots = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) dots.push([3 + i * 3.33, 3 + j * 3.33]);
  const line = {
    top: { x1: 1.5, y1: 1.5, x2: 16.5, y2: 1.5 },
    bottom: { x1: 1.5, y1: 16.5, x2: 16.5, y2: 16.5 },
    left: { x1: 1.5, y1: 1.5, x2: 1.5, y2: 16.5 },
    right: { x1: 16.5, y1: 1.5, x2: 16.5, y2: 16.5 },
  }[side];
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      {side === "center" ? (
        <>
          <rect x="3" y="3" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" />
        </>
      ) : (
        <>
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.85" fill="currentColor" opacity="0.55" />
          ))}
          <line {...line} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

const PAD = [
  { side: "top", row: 1, col: 2, title: "위쪽에 붙이기" },
  { side: "left", row: 2, col: 1, title: "왼쪽에 붙이기" },
  { side: "center", row: 2, col: 2, title: "가운데" },
  { side: "right", row: 2, col: 3, title: "오른쪽에 붙이기" },
  { side: "bottom", row: 3, col: 2, title: "아래쪽에 붙이기" },
];

const MARGINS = [
  { side: "left", title: "왼쪽 여백" },
  { side: "top", title: "위쪽 여백" },
  { side: "right", title: "오른쪽 여백" },
  { side: "bottom", title: "아래쪽 여백" },
];

/** 여백 px 입력 — Enter/blur 에 한 번만 확정 */
function PxField({ side, title, value, onCommit }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? String(Math.round(value));
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n)) onCommit(n);
    setDraft(null);
  };
  return (
    <label
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: "var(--control-height-sm)",
        padding: "0 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-fill)",
        minWidth: 0,
        color: "var(--color-text-muted)",
      }}
    >
      <EdgeIcon side={side} size={14} />
      <input
        value={shown}
        inputMode="numeric"
        aria-label={title}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // 여백은 절대 위치라 Enter 와 blur 가 같은 값을 두 번 보내도 결과가 같다
          if (e.key === "Enter") commit();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onCommit(Math.round(value) + (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1));
            setDraft(null);
          }
        }}
        className="ty-caption1"
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          background: "transparent",
          fontWeight: "var(--font-weight-medium)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--color-text-primary)",
          padding: 0,
        }}
      />
    </label>
  );
}

export default function ImageAdjustPanel({
  image,
  editing,
  onToggleEditing,
  onTransformChange,
  bannerSize,
  expandDirs,
  onToggleDir,
  expandAmount,
  onAmountChange,
  expandMethod,
  onMethodChange,
  onExpand,
  onContentAwareScale,
  onRevertEdits,
  status,
  // 템플릿 기본 배치로 되돌리기 (툴바 "이미지 초기화" 와 같은 동작)
  onReset,
  resetDisabled = false,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  if (!image?.src) return null;

  const transform = { ...DEFAULT_TRANSFORM, ...image.transform };
  const running = status?.running;
  const targetRatio = bannerSize.w / bannerSize.h;
  const sourceRatio = (image.srcSize?.w || 1) / (image.srcSize?.h || 1);
  const ratioGap = targetRatio / sourceRatio;
  const activeMethod = EXPAND_METHODS.find((m) => m.id === expandMethod);
  const anyDir = Object.values(expandDirs).some(Boolean);
  const set = (patch) => onTransformChange({ ...transform, ...patch });

  // 지금 이미지가 캔버스 위 어디에 그려지는지 (배너 px) — 정렬·여백의 기준
  const source = resolveImageSource(image);
  const fit = image.fit || (source?.isCutout ? "contain" : "cover");
  const W = bannerSize.w;
  const H = bannerSize.h;
  const box = computeImageLayout({ transform, source, canvasW: W, canvasH: H, fit });
  const margin = {
    left: box.left,
    top: box.top,
    right: W - (box.left + box.drawW),
    bottom: H - (box.top + box.drawH),
  };
  /** 한 변을 캔버스 변에서 px 만큼 떨어지게 — 같은 축의 반대 변은 크기를 유지한 채 따라온다 */
  const setEdge = (side, px) => {
    if (side === "left" || side === "right") {
      const left = side === "left" ? px : W - px - box.drawW;
      set({ x: (left - (W - box.drawW) / 2) / W });
    } else {
      const top = side === "top" ? px : H - px - box.drawH;
      set({ y: (top - (H - box.drawH) / 2) / H });
    }
  };
  const near = (v) => Math.abs(v) < 0.5;
  const padActive = {
    top: near(margin.top),
    bottom: near(margin.bottom),
    left: near(margin.left),
    right: near(margin.right),
    center: Math.abs(transform.x) < 0.002 && Math.abs(transform.y) < 0.002,
  };

  return (
    <SidebarSection title="이미지 조정">
      <button
        onClick={onToggleEditing}
        style={actionButton(editing ? "solid" : "outline", false)}
        title="미리보기에서 핸들로 크기를, 드래그로 위치를, 휠로 확대·축소합니다"
      >
        {editing ? "직접 조정 중 — 미리보기에서 드래그" : "미리보기에서 직접 조정"}
      </button>

      {/* 크기 — 슬라이더 + 숫자 */}
      <label style={labelStyle}>크기</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={transform.scale}
          onChange={(e) => set({ scale: parseFloat(e.target.value) })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <div style={{ width: 80, display: "flex" }}>
          <PercentField
            prefix="W"
            value={Math.round(transform.scale * 100)}
            min={Math.round(MIN_SCALE * 100)}
            max={Math.round(MAX_SCALE * 100)}
            onChange={(v) => set({ scale: v / 100 })}
          />
        </div>
      </div>

      {/* 정렬 + 여백 — 왼쪽 점선 패드, 오른쪽 변별 여백(px) */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <FieldLabel>정렬</FieldLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 30px)",
              gridTemplateRows: "repeat(3, 30px)",
              gap: 2,
            }}
          >
            {PAD.map((b) => (
              <button
                key={b.side}
                type="button"
                title={b.title}
                aria-label={b.title}
                aria-pressed={padActive[b.side]}
                onClick={() => (b.side === "center" ? set({ x: 0, y: 0 }) : setEdge(b.side, 0))}
                style={{
                  gridRow: b.row,
                  gridColumn: b.col,
                  width: "var(--control-height-sm)",
                  height: "var(--control-height-sm)",
                  borderRadius: "var(--radius-sm)",
                  border: padActive[b.side] ? "1px solid var(--color-border)" : "1px solid transparent",
                  background: padActive[b.side] ? "var(--color-card)" : "transparent",
                  boxShadow: padActive[b.side] ? "var(--shadow-card)" : "none",
                  color: padActive[b.side] ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <EdgeIcon side={b.side} />
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel>여백 (px)</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {MARGINS.map((m) => (
              <PxField key={m.side} side={m.side} title={m.title} value={margin[m.side]} onCommit={(px) => setEdge(m.side, px)} />
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onReset}
        disabled={resetDisabled}
        style={{ ...chipButton(false), width: "100%", marginBottom: 12, opacity: resetDisabled ? 0.5 : 1 }}
      >
        템플릿 기본 배치로 초기화
      </button>

      {/* ------------------ 고급 편집 (접힘) ------------------ */}
      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 0",
          border: "none",
          borderTop: "1px solid var(--color-border)",
          background: "none",
          fontSize: "var(--font-caption1-size)",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-text-secondary)",
        }}
      >
        고급 편집 · 배경 확장 / 비율 맞춤
        <span style={{ fontSize: "var(--font-caption2-size)", transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▼
        </span>
      </button>

      {advancedOpen && (
        <div style={{ paddingTop: 6 }}>
          <label style={labelStyle}>배경 확장</label>
          <div style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 8 }}>
            캔버스를 늘리고 늘어난 부분을 채웁니다. 텍스트가 놓일 빈 배경이 필요할 때 씁니다.
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {EXPAND_DIRECTIONS.map((dir) => (
              <button key={dir.id} onClick={() => onToggleDir(dir.id)} style={chipButton(Boolean(expandDirs[dir.id]))}>
                {dir.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-bold)" }}>확장량</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={expandAmount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-text-muted)", width: 34, textAlign: "right" }}>
              {Math.round(expandAmount * 100)}%
            </span>
          </div>
          <select
            value={expandMethod}
            onChange={(e) => onMethodChange(e.target.value)}
            title={activeMethod?.hint}
            style={{
              width: "100%",
              height: 32,
              padding: "0 8px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "var(--font-caption1-size)",
              background: "var(--color-fill)",
              marginBottom: 8,
            }}
          >
            {EXPAND_METHODS.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available()}>
                {m.name} — {m.desc}
                {m.available() ? "" : " (미설정)"}
              </option>
            ))}
          </select>
          <button onClick={onExpand} disabled={running || !anyDir} style={actionButton("solid", running || !anyDir)}>
            {running ? `${status.label}…` : "배경 확장 실행"}
          </button>

          <label style={{ ...labelStyle, marginTop: 4 }}>배너 비율에 맞추기</label>
          <div style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 8 }}>
            피사체는 두고 여백만 늘려 배너 비율({targetRatio.toFixed(2)}:1)에 맞춥니다. 지금 이미지 {sourceRatio.toFixed(2)}:1
            {ratioGap > MAX_CARVE_RATIO && " — 차이가 커서 여러 번 실행이 필요합니다"}
          </div>
          <button onClick={onContentAwareScale} disabled={running} style={actionButton("outline", running)}>
            내용 인식 비율 실행
          </button>
        </div>
      )}

      {running && (
        <div style={{ height: 4, background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden", marginBottom: 8 }}>
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
      {status?.error && <div style={notice("error")}>{status.error}</div>}
      {status?.warning && !status?.error && <div style={notice("warn")}>{status.warning}</div>}

      {image.edits?.length > 0 && (
        <>
          <div style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-primary-text)", fontWeight: "var(--font-weight-bold)", lineHeight: 1.5, marginBottom: 6 }}>
            적용된 편집: {image.edits.join(" → ")}
            <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-medium)" }}>
              {" "}
              · 현재 {image.srcSize?.w}×{image.srcSize?.h}px
            </span>
          </div>
          <button onClick={onRevertEdits} style={actionButton("outline", false)}>
            업로드 원본으로 되돌리기
          </button>
        </>
      )}
    </SidebarSection>
  );
}
