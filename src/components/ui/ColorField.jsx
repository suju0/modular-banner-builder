import { useEffect, useRef, useState } from "react";

import { isTransparent, normalizeHex } from "../../lib/color";
import ColorPickerPanel, { RgbInputs } from "./ColorPickerPanel";

/**
 * ColorField — 한 줄 색 지정 (레퍼런스 "Background [■ #FFFFFF ▾] 👁 −" 형태)
 *
 *   [라벨]  [■ #HEX          ]  [↺]
 *
 * 역할마다 한 줄씩 늘어놓아, 드롭다운으로 역할을 고른 뒤에야 색을 바꿀 수 있던 단계를 없앤다.
 * 색 점을 누르면 바로 아래에 인라인 피커가 열린다. 기본값과 다르면 ↺ 로 되돌린다.
 * allowNone 이면 눈 아이콘으로 "색 없음(투명)" 을 켜고 끈다 (배경 전용).
 */

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(-45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--semantic-line-solid-normal) 75%), linear-gradient(-45deg, transparent 75%, var(--semantic-line-solid-normal) 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
  backgroundColor: "var(--semantic-static-white)",
};

/** 아이콘 버튼 — DS IconButton sm(32px, r8) */
const iconBtn = {
  width: 32,
  height: 32,
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--color-text-muted)",
  flexShrink: 0,
};

function EyeIcon({ off }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.9" />
      {off && <path d="M2.5 13.5l11-11" />}
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" />
    </svg>
  );
}

export default function ColorField({
  label,
  value,
  overridden = false,
  onChange,
  onReset,
  allowNone = false,
  onToggleNone,
  labelWidth = 72,
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

  const commit = (raw) => {
    const hex = normalizeHex(raw);
    if (!hex) {
      setError("HEX 6자리로 입력해 주세요");
      return;
    }
    setError(null);
    onChange(hex);
  };

  return (
    <div ref={rootRef}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {label && (
          <span
            className="ty-caption1"
            style={{
              width: labelWidth,
              flexShrink: 0,
              color: "var(--color-text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </span>
        )}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            /* DS TextField — 라운드 12. 높이는 패널 기준 md(40) */
            height: "var(--control-height-md)",
            padding: "0 12px",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-fill)",
            outline: open ? "1px solid var(--semantic-line-primary-strong)" : "none",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={`${label || "색"} 선택`}
            style={{
              width: 16,
              height: 16,
              borderRadius: "var(--radius-checkbox)",
              padding: 0,
              flexShrink: 0,
              border: "1px solid var(--color-border-alpha)",
              ...(none ? CHECKER : { background: value }),
            }}
          />
          <input
            value={none ? "" : draft}
            placeholder={none ? "없음" : ""}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setError(null)}
            onBlur={() => draft && !none && commit(draft)}
            onKeyDown={(e) => e.key === "Enter" && commit(draft)}
            aria-label={`${label || "색"} HEX`}
            className="ty-caption1"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              fontWeight: "var(--font-weight-bold)",
              fontVariantNumeric: "tabular-nums",
              textTransform: "uppercase",
              padding: 0,
              color: "var(--color-text-primary)",
            }}
          />
        </div>
        {allowNone && (
          <button
            type="button"
            onClick={onToggleNone}
            title={none ? "색 켜기" : "색 없음 (투명)"}
            aria-label={none ? "색 켜기" : "색 없음 (투명)"}
            aria-pressed={!none}
            style={iconBtn}
          >
            <EyeIcon off={none} />
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          disabled={!overridden}
          title="기본값으로"
          aria-label={`${label || "색"} 기본값으로`}
          style={{ ...iconBtn, opacity: overridden ? 1 : 0.3, cursor: overridden ? "pointer" : "default" }}
        >
          <ResetIcon />
        </button>
      </div>

      {error && (
        <div
          className="ty-caption2"
          style={{ color: "var(--color-danger-text)", marginTop: 4, paddingLeft: label ? labelWidth + 8 : 0 }}
        >
          {error}
        </div>
      )}

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <ColorPickerPanel value={none ? "#FFFFFF" : value} onChange={onChange} onEyedropError={setError} />
          <div style={{ marginTop: 12 }}>
            <RgbInputs value={none ? "#FFFFFF" : value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
}
