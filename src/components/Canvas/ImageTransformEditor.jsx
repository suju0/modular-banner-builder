import { useEffect, useRef, useState } from "react";

import {
  HANDLES,
  computeImageLayout,
  panTransform,
  resizeTransformByHandle,
  resolveImageSource,
  zoomAt,
} from "../../lib/imageTransform";

/**
 * ImageTransformEditor
 *
 * 배경 이미지를 포토샵 자유 변형처럼 조작하는 레이어.
 * - 코너 4 + 엣지 중앙 4 = 8개 핸들 (흰 정사각형 + 파란 테두리)
 * - 핸들 드래그: 비율 유지 리사이즈, 반대쪽 지점 고정
 * - 본체 드래그: 위치 이동 / 마우스 휠: 커서 기준 확대·축소
 * - 크기가 바뀌면 우하단에 비율 뱃지를 1.2초 표시
 *
 * 실제 렌더는 BannerRenderer 의 배경 레이어가 담당하고 여기서는 조작과 가이드만 그린다.
 * (편집 화면과 Export 결과가 어긋날 여지를 없애기 위한 분리)
 */

const ACCENT = "var(--color-primary)";
const BADGE_MS = 1200;

export default function ImageTransformEditor({
  image,
  canvasW,
  canvasH,
  fit = "cover",
  previewScale = 1,
  onTransformChange,
}) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const badgeTimer = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [badge, setBadge] = useState(null);

  const source = resolveImageSource(image);
  const transform = image?.transform;

  const layout = source
    ? computeImageLayout({ transform, source, canvasW, canvasH, fit })
    : null;

  // 프리뷰 배율의 역수 — 편집 UI 는 화면상 크기를 일정하게 유지한다
  const px = (value) => value / (previewScale || 1);

  const showBadge = (scale) => {
    setBadge(`${Math.round(scale * 100)}%`);
    clearTimeout(badgeTimer.current);
    badgeTimer.current = setTimeout(() => setBadge(null), BADGE_MS);
  };

  useEffect(() => () => clearTimeout(badgeTimer.current), []);

  // 휠 줌 — React 의 onWheel 은 passive 로 붙어 preventDefault 가 통하지 않으므로
  // 네이티브 리스너를 직접 등록한다.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !layout) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointX = (e.clientX - rect.left) / (previewScale || 1);
      const pointY = (e.clientY - rect.top) / (previewScale || 1);
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = zoomAt(
        layout.transform,
        layout.transform.scale * factor,
        pointX,
        pointY,
        layout,
        canvasW,
        canvasH,
      );
      onTransformChange(next);
      showBadge(next.scale);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout, previewScale, canvasW, canvasH, onTransformChange]);

  if (!source || !layout) return null;

  const beginDrag = (e, kind, handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      layout,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(kind);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / (previewScale || 1);
    const dy = (e.clientY - drag.startY) / (previewScale || 1);

    if (drag.kind === "move") {
      onTransformChange(panTransform(drag.layout.transform, dx, dy, canvasW, canvasH));
      return;
    }

    const next = resizeTransformByHandle(drag.handle, dx, dy, drag.layout, canvasW, canvasH);
    onTransformChange(next);
    showBadge(next.scale);
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(null);
  };

  // 이미지 박스는 캔버스를 넘어갈 수 있다(cover 기본). 핸들이 잘려 안 보이면
  // 잡을 수 없으므로 표시 좌표만 캔버스 안으로 당겨 둔다 (계산은 실제 좌표로 한다).
  const inset = px(9);
  const clampX = (v) => Math.min(canvasW - inset, Math.max(inset, v));
  const clampY = (v) => Math.min(canvasH - inset, Math.max(inset, v));

  return (
    <div
      ref={rootRef}
      data-export-ignore=""
      onPointerDown={(e) => beginDrag(e, "move")}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: "absolute",
        inset: 0,
        cursor: dragging === "move" ? "grabbing" : "grab",
        touchAction: "none",
        background: "rgba(var(--semantic-primary-normal-rgb), 0.05)",
      }}
    >
      {/* 이미지 실제 경계 */}
      <div
        style={{
          position: "absolute",
          left: layout.left,
          top: layout.top,
          width: layout.drawW,
          height: layout.drawH,
          outline: `${px(1.5)}px dashed ${ACCENT}`,
          pointerEvents: "none",
        }}
      />

      {/* 3분할 가이드 (캔버스 기준) */}
      {[1, 2].map((i) => (
        <div
          key={`v${i}`}
          style={{
            position: "absolute",
            left: `${(i * 100) / 3}%`,
            top: 0,
            bottom: 0,
            width: px(1),
            background: "rgba(var(--semantic-static-white-rgb), 0.4)",
            pointerEvents: "none",
          }}
        />
      ))}
      {[1, 2].map((i) => (
        <div
          key={`h${i}`}
          style={{
            position: "absolute",
            top: `${(i * 100) / 3}%`,
            left: 0,
            right: 0,
            height: px(1),
            background: "rgba(var(--semantic-static-white-rgb), 0.4)",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* 8개 핸들 */}
      {HANDLES.map((handle) => {
        const realX = layout.left + handle.ax * layout.drawW;
        const realY = layout.top + handle.ay * layout.drawH;
        const sizePx = px(11);
        return (
          <div
            key={handle.id}
            onPointerDown={(e) => beginDrag(e, "resize", handle)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: "absolute",
              left: clampX(realX) - sizePx / 2,
              top: clampY(realY) - sizePx / 2,
              width: sizePx,
              height: sizePx,
              background: "var(--semantic-static-white)",
              border: `${px(2)}px solid ${ACCENT}`,
              borderRadius: px(1),
              boxShadow: `0 0 0 ${px(1)}px rgba(var(--semantic-static-white-rgb), 0.6)`,
              cursor: handle.cursor,
              touchAction: "none",
            }}
          />
        );
      })}

      {/* 비율 뱃지 (크기 변경 시 1.2초) */}
      {badge && (
        <div
          style={{
            position: "absolute",
            right: px(10),
            bottom: px(10),
            padding: `${px(4)}px ${px(9)}px`,
            borderRadius: px(4),
            background: "rgba(var(--semantic-label-normal-rgb), 0.82)",
            color: "var(--semantic-static-white)",
            fontSize: px(12),
            fontWeight: 700,
            fontFamily: "var(--font-family)",
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
          }}
        >
          {badge}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: "100%",
          marginBottom: px(6),
          padding: `${px(2)}px ${px(7)}px`,
          borderRadius: px(4),
          background: ACCENT,
          color: "var(--semantic-static-white)",
          fontSize: px(10),
          fontWeight: 700,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          fontFamily: "var(--font-family)",
        }}
      >
        이미지 조정 · 드래그 이동 / 핸들·휠 크기 조정
      </div>
    </div>
  );
}
