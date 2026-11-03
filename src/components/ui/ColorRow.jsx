import { useEffect, useRef, useState } from "react";

import { isTransparent, normalizeHex } from "../../lib/color";
import ColorPickerPanel, { RgbInputs } from "./ColorPickerPanel";

/**
 * ColorRow
 *
 * 색 하나를 고치는 컴팩트 행: [색 점] [# HEX] [기본값]
 * 점을 누르면 인라인 피커(채도·명도 + 색상 슬라이더)가 펼쳐진다.
 */

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(-45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--semantic-line-solid-normal) 75%), linear-gradient(-45deg, transparent 75%, var(--semantic-line-solid-normal) 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
  backgroundColor: "var(--semantic-static-white)",
};

export default function ColorRow({
  label,
  desc,
  value,
  overridden = false,
  onChange,
  onReset,
  resetLabel = "기본값",
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);
  const rootRef = useRef(null);
  const none = isTransparent(value);

  useEffect(() => setDraft(none ? "" : String(value).replace("#", "")), [value, none]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const commitHex = (raw) => {
    const normalized = normalizeHex(raw);
    if (!normalized) {
      setError("HEX 6자리로 입력해 주세요");
      return;
    }
    setError(null);
    onChange(normalized);
  };

  return (
    <div ref={rootRef} style={{ marginBottom: 12 }}>
      {label && (
        <div
          className="ty-caption1"
          style={{
            fontWeight: "var(--font-weight-medium)",
            color: "var(--color-text-secondary)",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`${label || "색"} 선택`}
          style={{
            width: "var(--control-height-sm)",
            height: "var(--control-height-sm)",
            borderRadius: "50%",
            flexShrink: 0,
            border: open ? "2px solid var(--color-primary)" : "1px solid var(--color-border-alpha)",
            ...(none ? CHECKER : { background: value }),
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0 12px",
            height: "var(--control-height-md)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
          }}
        >
          <span className="ty-caption1" style={{ color: "var(--color-text-muted)" }}>#</span>
          <input
            value={none ? "" : draft}
            placeholder={none ? "미지정" : "5F0080"}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft && commitHex(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitHex(draft);
            }}
            className="ty-caption1"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              fontWeight: "var(--font-weight-bold)",
              fontFamily: "inherit",
              fontVariantNumeric: "tabular-nums",
              background: "transparent",
              color: "var(--color-text-primary)",
            }}
          />
        </div>
        {onReset && (
          <button
            onClick={onReset}
            disabled={!overridden}
            className="ty-label2"
            /* DS Button md — r10 · 높이 40 · 좌우 20 */
            style={{
              padding: "0 20px",
              height: "var(--control-height-md)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
              fontWeight: "var(--font-weight-bold)",
              color: overridden ? "var(--color-primary-text)" : "var(--color-text-muted)",
              opacity: overridden ? 1 : 0.55,
              flexShrink: 0,
            }}
          >
            {resetLabel}
          </button>
        )}
      </div>

      {(error || desc) && (
        <div
          className="ty-caption2"
          style={{ color: error ? "var(--color-danger-text)" : "var(--color-text-muted)", marginTop: 6 }}
        >
          {error || desc}
        </div>
      )}

      {open && (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <ColorPickerPanel value={value} onChange={onChange} onEyedropError={setError} />
          <div style={{ marginTop: 12 }}>
            <RgbInputs value={value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
}
