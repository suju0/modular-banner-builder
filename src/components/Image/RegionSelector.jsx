import { useCallback, useEffect, useRef, useState } from "react";

import { QuickSelectMask } from "../../lib/quickSelect";

/**
 * RegionSelector — "남길 영역" 지정 모달
 *
 * 두 가지 도구를 쓴다.
 *   빠른 선택 (기본) : 포토샵 '빠른 선택 도구'처럼 남길 피사체 위를 브러시로 칠하면
 *                      비슷한 색의 영역이 경계까지 자동으로 넓어진다. Alt(또는 빼기 모드)로 덜어낸다.
 *   사각형           : 남길 범위를 사각형으로 지정 — 밖은 지우고, 안쪽 단색 배경은 자동 제거.
 *
 * 결과는 정규화 좌표라 원본 해상도와 무관하다.
 *   { type: "mask", mask: dataURL(흰색=남김), bounds: {x,y,w,h} }  또는
 *   { type: "rect", region: {x,y,w,h} }
 */

const MIN_SIZE = 0.05;
const MAX_BOX = { w: 640, h: 440 };

const HANDLES = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
];

const TOOLS = [
  { id: "quick", label: "빠른 선택", desc: "남길 부분을 칠하면 경계까지 자동 선택" },
  { id: "rect", label: "사각형", desc: "남길 범위를 사각형으로 지정" },
];

function clampRegion(region) {
  const w = Math.min(1, Math.max(MIN_SIZE, region.w));
  const h = Math.min(1, Math.max(MIN_SIZE, region.h));
  return {
    x: Math.min(1 - w, Math.max(0, region.x)),
    y: Math.min(1 - h, Math.max(0, region.y)),
    w,
    h,
  };
}

/* DS Button md — 높이 40 · r10 · 좌우 20 · label2. 비활성은 상태 토큰으로 */
const buttonStyle = (variant, disabled = false) => {
  const solid = variant === "solid";
  return {
    height: "var(--control-height-md)",
    padding: "0 20px",
    borderRadius: "var(--radius-md)",
    fontSize: "var(--font-label2-size)",
    lineHeight: "var(--font-label2-line)",
    letterSpacing: "var(--font-label2-ls)",
    fontWeight: "var(--font-weight-bold)",
    border: solid ? "none" : `1px solid ${disabled ? "var(--color-border)" : "var(--color-border-strong)"}`,
    background: disabled ? "var(--color-disable-bg)" : solid ? "var(--color-primary)" : "var(--color-card)",
    color: disabled ? "var(--color-text-disable)" : solid ? "var(--color-on-primary)" : "var(--color-text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  };
};

/* DS SegmentedControl sm — 트랙 32/r8/패딩 2, 아이템 r6 · 좌우 16 */
const segTrack = {
  display: "flex",
  gap: 2,
  padding: 2,
  height: "var(--control-height-sm)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-fill)",
  flexShrink: 0,
};

const sliderLabel = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "var(--color-text-secondary)",
  fontWeight: "var(--font-weight-medium)",
  fontVariantNumeric: "tabular-nums",
};

const segButton = (active) => ({
  height: "100%",
  padding: "0 16px",
  borderRadius: "var(--radius-xs)",
  border: "none",
  background: active ? "var(--color-card)" : "transparent",
  boxShadow: active ? "var(--shadow-card)" : "none",
  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
  fontSize: "var(--font-caption1-size)",
  lineHeight: "var(--font-caption1-line)",
  letterSpacing: "var(--font-caption1-ls)",
  fontWeight: active ? "var(--font-weight-bold)" : "var(--font-weight-medium)",
  whiteSpace: "nowrap",
});

export default function RegionSelector({ src, initialSelection, onCancel, onApply }) {
  const [box, setBox] = useState(null);
  const [tool, setTool] = useState(initialSelection?.type === "rect" ? "rect" : "quick");
  const [region, setRegion] = useState(() =>
    clampRegion(initialSelection?.region || { x: 0.08, y: 0.08, w: 0.84, h: 0.84 }),
  );

  // 빠른 선택
  const [brush, setBrush] = useState(24);
  const [tolerance, setTolerance] = useState(28);
  const [subtract, setSubtract] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const [cursor, setCursor] = useState(null);
  const maskRef = useRef(null);
  const overlayRef = useRef(null);
  const paintingRef = useRef(false);

  const dragRef = useRef(null);
  const boxRef = useRef(null);
  // 처음 연 시점의 선택만 쓴다 — 부모가 다시 그려져도 칠하던 마스크를 초기화하지 않도록
  const initialRef = useRef(initialSelection);

  // 이미지를 모달에 맞춘 크기 + 빠른 선택용 작업 해상도 준비
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = async () => {
      if (!alive) return;
      const ratio = Math.min(MAX_BOX.w / img.naturalWidth, MAX_BOX.h / img.naturalHeight, 1);
      const next = { w: Math.round(img.naturalWidth * ratio), h: Math.round(img.naturalHeight * ratio) };
      const mask = new QuickSelectMask(img, next.w, next.h);
      const initial = initialRef.current;
      if (initial?.type === "mask" && initial.mask) await mask.load(initial.mask);
      maskRef.current = mask;
      setCoverage(mask.coverage());
      setBox(next);
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  const redraw = useCallback(() => {
    const canvas = overlayRef.current;
    const mask = maskRef.current;
    if (!canvas || !mask) return;
    mask.drawOverlay(canvas.getContext("2d"));
    setCoverage(mask.coverage());
  }, []);

  useEffect(() => {
    if (tool === "quick" && box) redraw();
  }, [tool, box, redraw]);

  const apply = useCallback(() => {
    if (tool === "rect") {
      onApply({ type: "rect", region });
      return;
    }
    const mask = maskRef.current;
    if (!mask || mask.coverage() < 0.001) return;
    const result = mask.finalize();
    redraw();
    onApply({ type: "mask", mask: result.dataUrl, bounds: result.bounds });
  }, [tool, region, onApply, redraw]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") apply();
      if (e.key === "Alt") setAltHeld(true);
      if (e.key === "[") setBrush((b) => Math.max(4, b - 4));
      if (e.key === "]") setBrush((b) => Math.min(120, b + 4));
    };
    const onKeyUp = (e) => e.key === "Alt" && setAltHeld(false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [onCancel, apply]);

  const toLocal = (e) => {
    const rect = boxRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };

  /* ---------------- 빠른 선택 ---------------- */
  const removing = subtract || altHeld;

  const paintAt = (e) => {
    const p = toLocal(e);
    maskRef.current?.paint(p.x, p.y, brush / 2, { subtract: removing || e.altKey, tolerance });
    redraw();
  };

  const onPaintDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    paintingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    paintAt(e);
  };
  const onPaintMove = (e) => {
    const p = toLocal(e);
    setCursor({ x: p.x, y: p.y });
    if (paintingRef.current) paintAt(e);
  };
  const onPaintUp = (e) => {
    paintingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  /* ---------------- 사각형 ---------------- */
  const toNormalized = (e) => {
    const p = toLocal(e);
    return { x: p.x / p.w, y: p.y / p.h };
  };

  const beginDrag = (e, kind, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const point = toNormalized(e);
    dragRef.current = { kind, handle, start: point, region };
    if (kind === "new") setRegion(clampRegion({ x: point.x, y: point.y, w: MIN_SIZE, h: MIN_SIZE }));
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toNormalized(e);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;

    if (drag.kind === "move") {
      setRegion(clampRegion({ ...drag.region, x: drag.region.x + dx, y: drag.region.y + dy }));
      return;
    }
    if (drag.kind === "new") {
      setRegion(
        clampRegion({
          x: Math.min(drag.start.x, point.x),
          y: Math.min(drag.start.y, point.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
        }),
      );
      return;
    }
    // resize — 잡은 코너의 반대편을 고정
    const r = drag.region;
    const left = drag.handle.includes("w") ? r.x + dx : r.x;
    const top = drag.handle.includes("n") ? r.y + dy : r.y;
    const right = drag.handle.includes("e") ? r.x + r.w + dx : r.x + r.w;
    const bottom = drag.handle.includes("s") ? r.y + r.h + dy : r.y + r.h;
    setRegion(
      clampRegion({
        x: Math.min(left, right),
        y: Math.min(top, bottom),
        w: Math.abs(right - left),
        h: Math.abs(bottom - top),
      }),
    );
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const activeTool = TOOLS.find((t) => t.id === tool);
  const canApply = tool === "rect" || coverage >= 0.001;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-dimmer)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-card)",
          borderRadius: "var(--radius-xl)",
          padding: 24,
          boxShadow: "var(--shadow-pop)",
          maxWidth: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <div className="ty-headline2" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)" }}>
            남길 영역 선택
          </div>
          <div style={segTrack}>
            {TOOLS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTool(t.id)} title={t.desc} style={segButton(tool === t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ty-caption1" style={{ marginBottom: 16, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          {tool === "quick" ? (
            <>
              남길 부분 위를 칠하면 비슷한 색의 영역이 경계까지 넓어집니다. 넘친 곳은 <b>빼기</b>(또는 Alt 를 누른 채)로 칠해 덜어 내세요.
              <br />
              브러시 크기 [ ] 키 · 적용하면 선택 안쪽의 작은 구멍은 자동으로 메워집니다.
            </>
          ) : (
            <>
              사각형 안쪽만 남기고 밖은 모두 제거합니다. 영역 안에 남은 단색 배경도 함께 지워집니다.
              <br />
              빈 곳을 드래그하면 새로 그리고, 사각형을 끌면 이동, 코너를 끌면 크기가 바뀝니다.
            </>
          )}
        </div>

        {tool === "quick" && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={segTrack}>
              <button type="button" onClick={() => setSubtract(false)} style={segButton(!removing)}>
                + 더하기
              </button>
              <button type="button" onClick={() => setSubtract(true)} style={segButton(removing)}>
                − 빼기
              </button>
            </div>
            <label className="ty-caption1" style={sliderLabel}>
              브러시
              <input type="range" min={4} max={120} step={2} value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ width: 90 }} />
              <span style={{ width: 32, color: "var(--color-text-muted)" }}>{brush}px</span>
            </label>
            <label
              title="낮을수록 색이 비슷한 곳만, 높을수록 넓게 선택합니다"
              className="ty-caption1"
              style={sliderLabel}
            >
              허용 범위
              <input type="range" min={6} max={80} step={1} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} style={{ width: 80 }} />
              <span style={{ width: 24, color: "var(--color-text-muted)" }}>{tolerance}</span>
            </label>
          </div>
        )}

        {box ? (
          <div
            ref={boxRef}
            className="preview-checker"
            onPointerDown={tool === "quick" ? onPaintDown : (e) => beginDrag(e, "new")}
            onPointerMove={tool === "quick" ? onPaintMove : handlePointerMove}
            onPointerUp={tool === "quick" ? onPaintUp : endDrag}
            onPointerCancel={tool === "quick" ? onPaintUp : endDrag}
            onPointerLeave={() => setCursor(null)}
            style={{
              position: "relative",
              width: box.w,
              height: box.h,
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              touchAction: "none",
              cursor: tool === "quick" ? "none" : "crosshair",
            }}
          >
            <img
              src={src}
              alt="영역 선택 대상"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none", pointerEvents: "none" }}
            />

            {tool === "quick" && (
              <>
                <canvas
                  ref={overlayRef}
                  width={box.w}
                  height={box.h}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                />
                {cursor && (
                  <div
                    style={{
                      position: "absolute",
                      left: cursor.x - brush / 2,
                      top: cursor.y - brush / 2,
                      width: brush,
                      height: brush,
                      borderRadius: "50%",
                      border: "2px solid var(--semantic-static-white)",
                      boxShadow: "0 0 0 1px rgba(var(--semantic-static-black-rgb), 0.55)",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--semantic-static-white)",
                      fontSize: "var(--font-label2-size)",
                      fontWeight: "var(--font-weight-bold)",
                      textShadow: "0 0 2px rgba(var(--semantic-static-black-rgb), 0.8)",
                    }}
                  >
                    {removing ? "−" : "+"}
                  </div>
                )}
              </>
            )}

            {tool === "rect" && (
              <>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background: "rgba(var(--semantic-label-normal-rgb), 0.55)",
                    clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                      ${region.x * 100}% ${region.y * 100}%,
                      ${region.x * 100}% ${(region.y + region.h) * 100}%,
                      ${(region.x + region.w) * 100}% ${(region.y + region.h) * 100}%,
                      ${(region.x + region.w) * 100}% ${region.y * 100}%,
                      ${region.x * 100}% ${region.y * 100}%)`,
                  }}
                />
                <div
                  onPointerDown={(e) => beginDrag(e, "move")}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{
                    position: "absolute",
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.w * 100}%`,
                    height: `${region.h * 100}%`,
                    border: "2px solid var(--color-primary)",
                    boxShadow: "0 0 0 1px rgba(var(--semantic-static-white-rgb), 0.6) inset",
                    cursor: "move",
                    touchAction: "none",
                  }}
                >
                  {HANDLES.map((handle) => (
                    <div
                      key={handle.id}
                      onPointerDown={(e) => beginDrag(e, "resize", handle.id)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      style={{
                        position: "absolute",
                        left: `${handle.x * 100}%`,
                        top: `${handle.y * 100}%`,
                        width: 12,
                        height: 12,
                        marginLeft: handle.x ? -12 : 0,
                        marginTop: handle.y ? -12 : 0,
                        background: "var(--semantic-static-white)",
                        border: "2px solid var(--color-primary)",
                        borderRadius: "var(--radius-full)",
                        cursor: handle.cursor,
                        touchAction: "none",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              width: MAX_BOX.w,
              height: 224,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--font-label2-size)",
            }}
          >
            이미지 불러오는 중…
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <span className="ty-caption1" style={{ color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", flex: 1 }}>
            {tool === "quick"
              ? coverage > 0
                ? `선택 영역 이미지의 ${Math.max(1, Math.round(coverage * 100))}%`
                : "남길 부분을 칠해 주세요"
              : `선택 영역 ${Math.round(region.w * 100)}% × ${Math.round(region.h * 100)}%`}
            {" · "}
            {activeTool.label}
          </span>
          {tool === "quick" ? (
            <button
              type="button"
              onClick={() => {
                maskRef.current?.clear();
                redraw();
              }}
              style={buttonStyle("outline")}
            >
              선택 지우기
            </button>
          ) : (
            <button type="button" onClick={() => setRegion({ x: 0, y: 0, w: 1, h: 1 })} style={buttonStyle("outline")}>
              전체 선택
            </button>
          )}
          <button type="button" onClick={onCancel} style={buttonStyle("outline")}>
            취소
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            style={buttonStyle("solid", !canApply)}
          >
            영역 적용
          </button>
        </div>
      </div>
    </div>
  );
}
