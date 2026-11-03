import { useRef, useState } from "react";

import {
  GRADIENT_TYPES,
  MIN_STOPS,
  normalizeGradient,
  resolveGradientBar,
  sampleGradient,
  stopColor,
} from "../../lib/gradient";
import { normalizeHex } from "../../lib/color";
import SidebarSection from "../ui/SidebarSection";
import Toggle from "../ui/Toggle";
import ColorPickerPanel from "../ui/ColorPickerPanel";

/**
 * GradientEditor — Figma Custom 패널과 같은 구성
 *
 *   [Linear ▾] [90°]            [⇄ 뒤집기] [↻ 90° 회전]
 *   ┌■────────────────────────────■┐   ← 막대 위 스톱 핸들 (드래그 이동 · 막대 클릭으로 추가)
 *   └───────────── 그라데이션 ─────┘
 *   Stops                         +
 *   [ 0 %] [■ EBECF0] [100 %]     −    ← 위치 · 색 · 불투명도 한 줄
 *   [100%] [■ 87888A] [100 %]     −
 *
 * 스톱 색을 비워 두면(color: null) 테마 배경색을 따라간다.
 */

const iconButton = {
  width: "var(--control-height-sm)",
  height: "var(--control-height-sm)",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--color-fill)",
  color: "var(--color-text-secondary)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const fieldBox = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  height: "var(--control-height-sm)",
  padding: "0 10px",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-fill)",
  minWidth: 0,
};

const bareInput = {
  border: "none",
  background: "transparent",
  fontSize: "var(--font-caption1-size)",
  fontWeight: "var(--font-weight-bold)",
  padding: 0,
  minWidth: 0,
  width: "100%",
  fontVariantNumeric: "tabular-nums",
};

const unit = { fontSize: "var(--font-caption2-size)", color: "var(--color-text-muted)", flexShrink: 0 };

/** 입력 중에는 로컬 문자열, Enter/blur 에 확정하는 숫자 칸 */
function NumberInput({ value, onCommit, min, max, style }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? String(value);
  const commit = (raw) => {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  return (
    <input
      value={shown}
      inputMode="numeric"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== null && commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(shown);
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          commit(Number(shown) + (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1));
        }
      }}
      style={{ ...bareInput, ...style }}
    />
  );
}

function HexInput({ value, onCommit }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? value.replace("#", "");
  const commit = () => {
    const hex = normalizeHex(shown);
    if (hex) onCommit(hex);
    setDraft(null);
  };
  return (
    <input
      value={shown}
      maxLength={7}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== null && commit()}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      style={{ ...bareInput, textTransform: "uppercase" }}
    />
  );
}

export default function GradientEditor({ gradient: raw, theme, onChange }) {
  const gradient = normalizeGradient(raw);
  const { stops } = gradient;
  const [selected, setSelected] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(null);
  const barRef = useRef(null);
  const dragRef = useRef(null);

  const sel = Math.min(selected, stops.length - 1);
  const linearish = gradient.type !== "radial";

  /** 스톱 배열을 바꾸고, 정렬 후에도 같은 스톱을 선택 상태로 유지한다 */
  const commitStops = (next, keep) => {
    const sorted = [...next].sort((a, b) => a.pos - b.pos);
    onChange({ ...gradient, stops: sorted });
    if (keep) setSelected(Math.max(0, sorted.indexOf(keep)));
  };
  const patchStop = (i, patch) => {
    const next = stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    commitStops(next, next[i]);
  };
  const addStopAt = (pos) => {
    const { color, opacity } = sampleGradient(gradient, theme, pos);
    const stop = { pos: Math.round(pos), color, opacity };
    commitStops([...stops, stop], stop);
  };
  const addStop = () => {
    // 가장 넓은 간격의 가운데에 넣는다
    let best = { gap: -1, pos: 50 };
    for (let i = 1; i < stops.length; i++) {
      const gap = stops[i].pos - stops[i - 1].pos;
      if (gap > best.gap) best = { gap, pos: stops[i - 1].pos + gap / 2 };
    }
    addStopAt(best.pos);
  };
  const removeStop = (i) => {
    if (stops.length <= MIN_STOPS) return;
    commitStops(stops.filter((_, idx) => idx !== i));
    setSelected(Math.max(0, i - 1));
    setPickerOpen(null);
  };

  const posFromEvent = (e) => {
    const rect = barRef.current.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
  };

  const onHandleDown = (i) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(i);
    dragRef.current = { stop: stops[i] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = Math.round(posFromEvent(e));
    const moved = { ...drag.stop, pos };
    const next = stops.map((s) => (s === drag.stop ? moved : s));
    drag.stop = moved;
    commitStops(next, moved);
  };
  const onHandleUp = (e) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <SidebarSection title="배경 그라데이션">
      <Toggle
        checked={gradient.enabled}
        onChange={() => onChange({ ...gradient, enabled: !gradient.enabled })}
        label="그라데이션 사용"
      />
      <div style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-text-muted)", lineHeight: 1.5, margin: "6px 0 12px" }}>
        배경 사진 위에 얹어 텍스트 가독성을 확보합니다. 불투명도 0% 인 쪽은 사진이 그대로 보입니다.
      </div>

      {gradient.enabled && (
        <>
          {/* 타입 · 각도 · 뒤집기 · 회전 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <select
              value={gradient.type}
              onChange={(e) => onChange({ ...gradient, type: e.target.value })}
              style={{
                flex: 1,
                minWidth: 0,
                height: "var(--control-height-sm)",
                padding: "0 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--color-fill)",
                fontSize: "var(--font-label2-size)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              {GRADIENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {linearish && (
              <div style={{ ...fieldBox, width: 64 }} title="각도">
                <NumberInput
                  value={gradient.angle}
                  min={-360}
                  max={720}
                  onCommit={(v) => onChange({ ...gradient, angle: ((v % 360) + 360) % 360 })}
                />
                <span style={unit}>°</span>
              </div>
            )}
            <button
              type="button"
              title="방향 뒤집기"
              aria-label="방향 뒤집기"
              onClick={() => commitStops(stops.map((s) => ({ ...s, pos: 100 - s.pos })))}
              style={iconButton}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h11M10 2l3 3-3 3M14 11H3M6 8l-3 3 3 3" />
              </svg>
            </button>
            {linearish && (
              <button
                type="button"
                title="90° 회전"
                aria-label="90도 회전"
                onClick={() => onChange({ ...gradient, angle: (gradient.angle + 90) % 360 })}
                style={iconButton}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" />
                </svg>
              </button>
            )}
          </div>

          {/* 막대 + 스톱 핸들 */}
          <div style={{ position: "relative", padding: "14px 9px 0", marginBottom: 14 }}>
            <div
              ref={barRef}
              className="preview-checker"
              onPointerDown={(e) => addStopAt(posFromEvent(e))}
              title="눌러서 스톱 추가"
              style={{
                position: "relative",
                height: 32,
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--color-border)",
                overflow: "hidden",
                cursor: "copy",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: resolveGradientBar(gradient, theme) }} />
            </div>
            {stops.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-label={`스톱 ${Math.round(s.pos)}%`}
                onPointerDown={onHandleDown(i)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                style={{
                  position: "absolute",
                  top: 0,
                  left: `calc(9px + (100% - 18px) * ${s.pos / 100})`,
                  transform: "translateX(-50%)",
                  width: 18,
                  height: 18,
                  padding: 2,
                  borderRadius: "var(--radius-checkbox)",
                  border: "none",
                  background: i === sel ? "var(--color-primary)" : "var(--color-card)",
                  boxShadow: "var(--shadow-raised)",
                  cursor: "ew-resize",
                  touchAction: "none",
                  zIndex: i === sel ? 2 : 1,
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    borderRadius: "var(--radius-full)",
                    background: stopColor(s, theme),
                    border: "1px solid var(--color-border-alpha)",
                  }}
                />
              </button>
            ))}
          </div>

          {/* Stops 목록 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: "var(--font-label2-size)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)" }}>Stops</span>
            <button type="button" onClick={addStop} aria-label="스톱 추가" title="스톱 추가" style={{ ...iconButton, border: "none", fontSize: "var(--font-headline1-size)" }}>
              +
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {stops.map((s, i) => {
              const hex = stopColor(s, theme);
              const active = i === sel;
              return (
                <div key={i}>
                  <div
                    onClick={() => setSelected(i)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "54px minmax(0, 1fr) 54px 26px",
                      gap: 6,
                      alignItems: "center",
                      padding: "4px 4px",
                      borderRadius: "var(--radius-xs)",
                      background: active ? "var(--color-primary-light)" : "transparent",
                    }}
                  >
                    <div style={fieldBox}>
                      <NumberInput value={Math.round(s.pos)} min={0} max={100} onCommit={(v) => patchStop(i, { pos: v })} />
                      <span style={unit}>%</span>
                    </div>
                    <div style={fieldBox}>
                      <button
                        type="button"
                        aria-label="색 선택"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(i);
                          setPickerOpen(pickerOpen === i ? null : i);
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          flexShrink: 0,
                          borderRadius: "var(--radius-full)",
                          border: "1px solid var(--color-border-alpha)",
                          background: hex,
                          padding: 0,
                        }}
                      />
                      <HexInput value={hex} onCommit={(v) => patchStop(i, { color: v })} />
                      {!s.color && (
                        <span title="테마 배경색을 따라갑니다" style={{ ...unit, fontSize: "var(--font-caption2-size)" }}>
                          테마
                        </span>
                      )}
                    </div>
                    <div style={fieldBox}>
                      <NumberInput
                        value={Math.round(s.opacity * 100)}
                        min={0}
                        max={100}
                        onCommit={(v) => patchStop(i, { opacity: v / 100 })}
                      />
                      <span style={unit}>%</span>
                    </div>
                    <button
                      type="button"
                      aria-label="스톱 삭제"
                      title={stops.length <= MIN_STOPS ? "스톱은 최소 2개가 필요합니다" : "스톱 삭제"}
                      disabled={stops.length <= MIN_STOPS}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStop(i);
                      }}
                      style={{
                        ...iconButton,
                        width: "var(--control-height-sm)",
                        border: "none",
                        background: "transparent",
                        fontSize: "var(--font-body1-size)",
                        opacity: stops.length <= MIN_STOPS ? 0.3 : 1,
                      }}
                    >
                      −
                    </button>
                  </div>

                  {pickerOpen === i && (
                    <div style={{ padding: "8px 4px 10px" }}>
                      <ColorPickerPanel value={hex} onChange={(v) => patchStop(i, { color: v })} />
                      {s.color && (
                        <button
                          type="button"
                          onClick={() => patchStop(i, { color: null })}
                          style={{
                            marginTop: 6,
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontSize: "var(--font-caption2-size)",
                            fontWeight: "var(--font-weight-bold)",
                            color: "var(--color-primary-text)",
                          }}
                        >
                          테마 배경색으로 되돌리기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </SidebarSection>
  );
}
