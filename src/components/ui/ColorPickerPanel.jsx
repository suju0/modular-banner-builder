import { useEffect, useRef, useState } from "react";

import {
  hexToRgb,
  hsvToHex,
  hexToHsv,
  isTransparent,
  normalizeHex,
  pickScreenColor,
  supportsEyeDropper,
} from "../../lib/color";

/**
 * ColorPickerPanel
 *
 * Figma 스타일 인라인 컬러 피커.
 * native input[type=color] 은 OS 대화상자를 띄워 흐름이 끊기므로,
 * 채도·명도 사각형 + 색상 슬라이더를 직접 그린다.
 */

const SV_HEIGHT = 132;

export default function ColorPickerPanel({ value, onChange, onEyedropError }) {
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const dragRef = useRef(null);

  const safeValue = isTransparent(value) ? "#FFFFFF" : value;
  const [hsv, setHsv] = useState(() => hexToHsv(safeValue) || { h: 0, s: 0, v: 100 });

  // 외부에서 값이 바뀌면(테마 변경·기본값 복원) 핸들 위치를 맞춘다.
  // 단, 드래그 중에는 무시해야 손맛이 튀지 않는다.
  useEffect(() => {
    if (dragRef.current) return;
    const next = hexToHsv(isTransparent(value) ? "#FFFFFF" : value);
    if (next) setHsv(next);
  }, [value]);

  const commit = (next) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const readSv = (e) => {
    const rect = svRef.current.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 100;
    const v = 100 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) * 100;
    return { ...hsv, s, v };
  };

  const readHue = (e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const h = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 360;
    return { ...hsv, h };
  };

  const startDrag = (kind) => (e) => {
    e.preventDefault();
    dragRef.current = kind;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    commit(kind === "sv" ? readSv(e) : readHue(e));
  };

  const onMove = (e) => {
    if (!dragRef.current) return;
    commit(dragRef.current === "sv" ? readSv(e) : readHue(e));
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleEyedrop = async () => {
    try {
      const picked = await pickScreenColor();
      if (picked) onChange(picked);
    } catch (err) {
      onEyedropError?.(err.message);
    }
  };

  const hueColor = hsvToHex({ h: hsv.h, s: 100, v: 100 });

  return (
    <div>
      {/* 채도 · 명도 */}
      <div
        ref={svRef}
        onPointerDown={startDrag("sv")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "relative",
          height: SV_HEIGHT,
          borderRadius: "var(--radius-sm)",
          cursor: "crosshair",
          touchAction: "none",
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            borderRadius: "50%",
            border: "2px solid var(--semantic-static-white)",
            boxShadow: "0 0 0 1px var(--semantic-line-normal-normal)",
            background: safeValue,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* 색상(Hue) */}
      <div
        ref={hueRef}
        onPointerDown={startDrag("hue")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "relative",
          height: 12,
          borderRadius: "var(--radius-full)",
          cursor: "ew-resize",
          touchAction: "none",
          background:
            "linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${(hsv.h / 360) * 100}%`,
            top: -3,
            width: 18,
            height: 18,
            marginLeft: -9,
            borderRadius: "50%",
            border: "3px solid var(--semantic-static-white)",
            boxShadow: "var(--shadow-raised)",
            background: hueColor,
            pointerEvents: "none",
          }}
        />
      </div>

      {supportsEyeDropper() && (
        <button
          onClick={handleEyedrop}
          className="ty-label2"
          style={{
            width: "100%",
            marginTop: 12,
            height: "var(--control-height-sm)",
            padding: "0 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--color-text-primary)",
          }}
        >
          화면에서 색 추출 (스포이드)
        </button>
      )}
    </div>
  );
}

/** RGB 숫자 입력 3칸 — 팝오버 하단에서 쓴다 */
export function RgbInputs({ value, onChange }) {
  const rgb = hexToRgb(isTransparent(value) ? "#FFFFFF" : value) || { r: 255, g: 255, b: 255 };

  const update = (channel, raw) => {
    const next = { ...rgb, [channel]: Math.max(0, Math.min(255, parseInt(raw, 10) || 0)) };
    onChange(
      normalizeHex(
        `#${[next.r, next.g, next.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      ),
    );
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {["r", "g", "b"].map((channel) => (
        <div key={channel} style={{ flex: 1 }}>
          <label
            className="ty-caption2"
            style={{
              fontWeight: "var(--font-weight-medium)",
              color: "var(--color-text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            {channel.toUpperCase()}
          </label>
          <input
            type="number"
            min={0}
            max={255}
            value={rgb[channel]}
            onChange={(e) => update(channel, e.target.value)}
            className="ty-caption1"
            style={{
              width: "100%",
              height: "var(--control-height-sm)",
              padding: "0 4px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              fontFamily: "inherit",
              boxSizing: "border-box",
              textAlign: "center",
            }}
          />
        </div>
      ))}
    </div>
  );
}
