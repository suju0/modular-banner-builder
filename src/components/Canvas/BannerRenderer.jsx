import {
  LAYOUTS,
  MODULE_DEFS,
  getFrameRadius,
  getTextWeights,
  resolveSlotBox,
} from "../../constants/layouts";
import { resolveTheme } from "../../constants/themes";
import { computeImageLayout, resolveImageSource } from "../../lib/imageTransform";
import { DEFAULT_GRADIENT, resolveGradient } from "../../lib/gradient";
import ImageTransformEditor from "./ImageTransformEditor";
import PreviewIndicator from "./PreviewIndicator";
import SlotBox from "./SlotBox";
import SlotRenderer from "./SlotRenderer";

/**
 * BannerRenderer
 *
 * 배너를 **항상 원본 픽셀 크기(size.w × size.h)로** 렌더하는 순수 컴포넌트.
 * 화면 프리뷰(BannerPreview)와 Export 스테이지(lib/exportImage.js)가 이 컴포넌트를 공유하므로
 * "보이는 것 = 내려받는 것"이 보장된다.
 *
 * 레이어 순서 (괄호는 z-index — 같은 스택 안에서는 DOM 순서보다 z-index 가 우선)
 *   배경색 (auto) → 배경 이미지 (auto) → 그라데이션 (1) → 텍스트 슬롯 (2)
 *   → CTA 바 (3) → 이미지 조정 핸들 (30) → 캐러셀 인디케이터 (40)
 *
 * 인디케이터·재생 버튼은 지면이 배너 위에 얹는 UI 라 항상 맨 위다.
 * 그라데이션을 깔아도 덮이지 않아야 위치를 제대로 확인할 수 있다.
 *
 * props 는 전부 직렬화 가능한 값이어야 한다 (Export 시 화면 밖에서 독립 렌더됨).
 */
export default function BannerRenderer({
  size,
  layout,
  theme,
  themeOverrides = null,
  gradient = DEFAULT_GRADIENT,
  content,
  modules,
  offsets = {},
  image = null,
  textPosition,
  textAlign,
  textWeight = "regular",
  tagStyle = "text",
  // 캐러셀 인디케이터는 지면 UI 라 배너 이미지에 굽지 않는다.
  // 위치 확인용으로 프리뷰에서만 그린다 (Export 경로에서는 항상 false).
  showIndicator = false,
  // --- 편집 모드 (프리뷰에서만 사용, Export 시에는 항상 false) ---
  interactive = false,
  adjustMode = false,
  previewScale = 1,
  selectedSlot = null,
  onSelectSlot,
  onOffsetChange,
  onDragChange,
  onTransformChange,
}) {
  const themeData = resolveTheme(theme, themeOverrides);
  const layoutData = LAYOUTS.find((l) => l.id === layout) || LAYOUTS[0];
  const weights = getTextWeights(textWeight);

  // 배경 이미지 — 슬롯이 아니라 캔버스 전체를 채운다 (transform 으로 구도 조정)
  const backgroundSource = resolveImageSource(image);
  // 누끼 이미지는 잘리면 상품이 손상되므로 전체가 보이도록 맞춘다
  const backgroundFit = image?.fit || (backgroundSource?.isCutout ? "contain" : "cover");
  const backgroundLayout = backgroundSource
    ? computeImageLayout({
        transform: image.transform,
        source: backgroundSource,
        canvasW: size.w,
        canvasH: size.h,
        fit: backgroundFit,
      })
    : null;

  // 그라데이션은 사진 위 가독성 확보가 목적이므로 이미지가 있을 때만 얹는다
  const gradientCss = backgroundSource ? resolveGradient(gradient, themeData) : null;

  return (
    <div
      data-banner-root=""
      style={{
        width: size.w,
        height: size.h,
        position: "relative",
        overflow: "hidden",
        background: themeData.bg,
        fontFamily: "var(--font-family)",
        flexShrink: 0,
        // 웹 배너는 각지게, 앱 팝업/시트는 지면 그대로 라운드 코너를 갖는다
        // (PNG 로 뽑으면 코너가 투명하게 저장된다)
        borderRadius: getFrameRadius(layoutData, size),
      }}
    >
      {/* 배경 이미지 */}
      {backgroundLayout && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <img
            src={backgroundSource.src}
            alt={image.name || ""}
            draggable={false}
            style={{
              position: "absolute",
              left: backgroundLayout.left,
              top: backgroundLayout.top,
              width: backgroundLayout.drawW,
              height: backgroundLayout.drawH,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* 가독성 그라데이션 */}
      {gradientCss && (
        <div style={{ position: "absolute", inset: 0, background: gradientCss, zIndex: 1 }} />
      )}

      {/* 텍스트 모듈 슬롯 */}
      <div style={{ position: "relative", width: "100%", height: "100%", zIndex: 2 }}>
        {MODULE_DEFS.map((m) => {
          if (!modules[m.id]) return null;
          // CTA 바는 지면 전체 폭을 쓰므로 슬롯이 아니라 아래 프레임 레이어에서 그린다
          if (m.id === "cta" && layoutData.cta?.style !== "button") return null;
          const box = resolveSlotBox(layoutData, m.id, { position: textPosition, align: textAlign });
          if (!box) return null;

          return (
            <SlotBox
              key={m.id}
              moduleId={m.id}
              label={m.label}
              slot={box}
              offset={offsets[m.id]}
              bannerSize={size}
              interactive={interactive}
              previewScale={previewScale}
              selected={selectedSlot === m.id}
              onSelect={onSelectSlot}
              onOffsetChange={onOffsetChange}
              onDragChange={onDragChange}
            >
              <SlotRenderer
                moduleId={m.id}
                content={content}
                theme={themeData}
                bannerSize={size}
                weights={weights}
                tagStyle={tagStyle}
                scale={box.scale}
              />
            </SlotBox>
          );
        })}
      </div>

      {/* 하단 CTA 바 (앱 모달 팝업) — 지면 전체 폭을 쓰므로 슬롯이 아니라 프레임 요소 */}
      {modules.cta && layoutData.cta?.style === "bar" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: size.h * 0.095,
            background: themeData.cta,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: size.h * 0.02,
            zIndex: 3,
          }}
        >
          <span
            style={{
              fontSize: Math.max(11, size.h * 0.032),
              fontWeight: weights.cta,
              color: themeData.ctaText,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {content.cta}
          </span>
          <span
            style={{
              fontSize: Math.max(10, size.h * 0.026),
              fontWeight: weights.cta,
              color: themeData.ctaText,
              opacity: 0.9,
            }}
          >
            ›
          </span>
        </div>
      )}

      {/* 캐러셀 인디케이터 + 재생 버튼 — 미리보기 전용, 항상 최상단 레이어 */}
      {showIndicator && layoutData.indicator && (
        <PreviewIndicator size={size} position={layoutData.indicator} />
      )}

      {/* 배경 이미지 조정 레이어 (8핸들 자유 변형) */}
      {adjustMode && backgroundSource && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
          <ImageTransformEditor
            image={image}
            canvasW={size.w}
            canvasH={size.h}
            fit={backgroundFit}
            previewScale={previewScale}
            onTransformChange={onTransformChange}
          />
        </div>
      )}
    </div>
  );
}
