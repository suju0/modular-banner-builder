import { useEffect, useRef, useState } from "react";

import { LAYOUTS } from "../../constants/layouts";
import { resolveTheme } from "../../constants/themes";
import { isTransparent } from "../../lib/color";
import BannerRenderer from "./BannerRenderer";

/**
 * BannerPreview
 *
 * BannerRenderer 를 원본 크기로 렌더한 뒤 CSS transform 으로 축소해서 보여준다.
 * (컨테이너 크기만 줄이면 폰트 크기가 함께 줄지 않아 프리뷰와 결과물이 어긋난다)
 *
 * 배율 계산은 **배너가 놓이는 스테이지 박스만** 측정한다.
 * 캡션·안내문이 들어 있는 바깥 컨테이너를 재면 세로 여유를 과대평가해서
 * 세로로 긴 규격(앱 모달 팝업 1080×1240)이 잘려 보였다.
 */
export default function BannerPreview({
  size,
  sizeLabel = "",
  layout,
  theme,
  themeOverrides,
  gradient,
  textPosition,
  textAlign,
  textWeight,
  tagStyle,
  content,
  modules,
  offsets,
  image,
  showIndicator = false,
  editMode = "none",
  selectedSlot,
  onSelectSlot,
  onOffsetChange,
  onTransformChange,
}) {
  const stageRef = useRef(null);
  const [stage, setStage] = useState({ w: 640, h: 420 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: Math.max(120, width), h: Math.max(120, height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 스테이지 안에 여백 8px 을 남기고 가로·세로 중 더 빡빡한 쪽에 맞춘다
  const scale = Math.min((stage.w - 8) / size.w, (stage.h - 8) / size.h, 1);
  const themeData = resolveTheme(theme, themeOverrides);
  const layoutData = LAYOUTS.find((l) => l.id === layout) || LAYOUTS[0];

  const slotEditing = editMode === "slots";
  const imageEditing = editMode === "image";

  return (
    <div
      onPointerDown={() => slotEditing && onSelectSlot?.(null)}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "16px 20px 14px",
      }}
    >
      {/* 규격 캡션 — 레퍼런스 빌더처럼 캔버스 위에 둔다 */}
      <div
        style={{
          fontSize: "var(--font-label2-size)",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-text-secondary)",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {sizeLabel} ({size.w}×{size.h})
      </div>

      {/* 배너가 놓이는 스테이지 — 이 박스만 측정해 배율을 정한다 */}
      <div
        ref={stageRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className={isTransparent(themeData.bg) ? "preview-checker" : undefined}
          style={{
            width: size.w * scale,
            height: size.h * scale,
            position: "relative",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            boxShadow: "var(--shadow-preview)",
            background: isTransparent(themeData.bg) ? "transparent" : themeData.bg,
            flexShrink: 0,
          }}
        >
          <div
            data-preview-banner=""
            style={{
              width: size.w,
              height: size.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <BannerRenderer
              size={size}
              layout={layout}
              theme={theme}
              themeOverrides={themeOverrides}
              gradient={gradient}
              textPosition={textPosition}
              textAlign={textAlign}
              textWeight={textWeight}
              tagStyle={tagStyle}
              content={content}
              modules={modules}
              offsets={offsets}
              image={image}
              showIndicator={showIndicator}
              interactive={slotEditing}
              adjustMode={imageEditing}
              previewScale={scale}
              selectedSlot={selectedSlot}
              onSelectSlot={onSelectSlot}
              onOffsetChange={onOffsetChange}
              onDragChange={setDragging}
              onTransformChange={onTransformChange}
            />
          </div>

          {/* 드래그 중 중앙 정렬 가이드 */}
          {slotEditing && dragging && (
            <>
              <div
                data-export-ignore=""
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "var(--semantic-line-primary-strong)",
                  pointerEvents: "none",
                }}
              />
              <div
                data-export-ignore=""
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: 1,
                  background: "var(--semantic-line-primary-strong)",
                  pointerEvents: "none",
                }}
              />
            </>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: "var(--font-caption1-size)",
          color: "var(--color-text-muted)",
          fontWeight: "var(--font-weight-medium)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span>
          {layoutData.name} · 프리뷰 {Math.round(scale * 100)}%
        </span>
        {slotEditing && (
          <span style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-bold)" }}>
            위치 편집 · 드래그 또는 방향키로 이동
          </span>
        )}
        {imageEditing && (
          <span style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-bold)" }}>
            이미지 조정 · 드래그 이동 / 핸들·휠 크기 조정
          </span>
        )}
      </div>
    </div>
  );
}
