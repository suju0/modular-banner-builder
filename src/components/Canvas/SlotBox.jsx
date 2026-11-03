import { useRef, useState } from "react";

/**
 * SlotBox
 *
 * 슬롯의 "위치"만 담당하는 래퍼. 시각적 표현은 children(SlotRenderer)이 담당한다.
 *
 * 위치 = 레이아웃이 정의한 기본 좌표(%) + 사용자 오프셋(%)
 * 오프셋을 % 로 저장하기 때문에 배너 사이즈를 바꿔도 상대 위치가 유지된다.
 * (docs/slot-system.md — "오프셋은 비율 유지" 요구사항)
 */

const NUDGE = 0.5; // 방향키 1회 이동량 (%)
const NUDGE_FAST = 2;
const SNAP_THRESHOLD = 0.8; // 원위치/중앙 스냅 허용 오차 (%)

/** "50%" → 50 (파싱 불가 시 null) */
function parsePercent(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(-?[\d.]+)%$/);
  return match ? parseFloat(match[1]) : null;
}

function withOffset(base, delta) {
  if (!delta) return base;
  const basePercent = parsePercent(base);
  if (basePercent !== null) return `${+(basePercent + delta).toFixed(2)}%`;
  return `calc(${base} + ${+delta.toFixed(2)}%)`;
}

export default function SlotBox({
  moduleId,
  label,
  slot,
  offset,
  interactive = false,
  selected = false,
  previewScale = 1,
  bannerSize,
  onSelect,
  onOffsetChange,
  onDragChange,
  children,
}) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dx = offset?.dx || 0;
  const dy = offset?.dy || 0;
  const moved = dx !== 0 || dy !== 0;

  const baseX = parsePercent(slot.x);
  const baseY = parsePercent(slot.y);

  const clampDelta = (base, delta) => {
    if (base === null) return delta;
    return Math.min(110 - base, Math.max(-10 - base, delta));
  };

  const snap = (base, delta) => {
    // 원위치 스냅
    if (Math.abs(delta) < SNAP_THRESHOLD) return 0;
    // 중앙(50%) 스냅
    if (base !== null && Math.abs(base + delta - 50) < SNAP_THRESHOLD) return 50 - base;
    return delta;
  };

  const commit = (nextDx, nextDy) => {
    onOffsetChange?.(moduleId, {
      dx: +clampDelta(baseX, snap(baseX, nextDx)).toFixed(2),
      dy: +clampDelta(baseY, snap(baseY, nextDy)).toFixed(2),
    });
  };

  const handlePointerDown = (e) => {
    if (!interactive || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(moduleId);

    dragRef.current = { startX: e.clientX, startY: e.clientY, dx, dy };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    onDragChange?.(true);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const scaledW = bannerSize.w * previewScale;
    const scaledH = bannerSize.h * previewScale;
    commit(
      drag.dx + ((e.clientX - drag.startX) / scaledW) * 100,
      drag.dy + ((e.clientY - drag.startY) / scaledH) * 100,
    );
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
    onDragChange?.(false);
  };

  const handleKeyDown = (e) => {
    if (!interactive) return;
    const step = e.shiftKey ? NUDGE_FAST : NUDGE;
    const map = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key === "Escape") {
      onSelect?.(null);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onOffsetChange?.(moduleId, { dx: 0, dy: 0 });
      return;
    }
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    // 방향키 이동은 스냅 없이 정확히 step 만큼
    onOffsetChange?.(moduleId, {
      dx: +clampDelta(baseX, dx + delta[0]).toFixed(2),
      dy: +clampDelta(baseY, dy + delta[1]).toFixed(2),
    });
  };

  const style = {
    position: "absolute",
    left: withOffset(slot.x, dx),
    top: withOffset(slot.y, dy),
    transform: slot.transform || "none",
    textAlign: slot.align || "left",
    width: slot.w || slot.maxW || "auto",
    height: slot.h || "auto",
    maxWidth: slot.maxW || "none",
    // 위치 트랜지션은 두지 않는다 — 애니메이션 중에는
    // getBoundingClientRect 가 보간된 좌표를 돌려줘서 정렬·X/Y 값이 어긋난다.
  };

  if (!interactive) {
    return (
      <div data-slot-id={moduleId} style={style}>
        {children}
      </div>
    );
  }

  // 프리뷰는 CSS transform 으로 축소되므로, 편집 UI 는 배율의 역수를 곱해
  // 화면상 크기가 일정하게 보이도록 보정한다.
  const px = (value) => value / (previewScale || 1);

  return (
    <div
      data-slot-id={moduleId}
      role="button"
      tabIndex={0}
      aria-label={`${label} 위치 조정`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      style={{
        ...style,
        zIndex: selected ? 20 : 10,
        cursor: dragging ? "grabbing" : "grab",
        outline: selected
          ? `${px(2)}px solid var(--color-primary)`
          : `${px(1)}px dashed ${moved ? "var(--semantic-line-primary-strong)" : "var(--semantic-line-primary-normal)"}`,
        outlineOffset: px(3),
        borderRadius: px(2),
        touchAction: "none",
      }}
    >
      {selected && (
        <div
          data-export-ignore=""
          style={{
            position: "absolute",
            left: 0,
            bottom: "100%",
            marginBottom: px(7),
            padding: `${px(2)}px ${px(7)}px`,
            borderRadius: px(4),
            background: "var(--color-primary)",
            color: "var(--color-on-primary)",
            fontSize: px(10),
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-family)",
          }}
        >
          {label}
          {moved ? ` · ${dx > 0 ? "+" : ""}${dx}% / ${dy > 0 ? "+" : ""}${dy}%` : " · 기본 위치"}
        </div>
      )}
      {children}
    </div>
  );
}
