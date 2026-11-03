import { useCallback, useEffect, useMemo, useState } from "react";


import { SIZES, sizesByChannel } from "./constants/sizes";
import {
  LAYOUTS,
  LAYOUT_CHANNELS,
  CONTENT_DEFAULTS,
  DEFAULT_MODULES,
  MODULE_DEFS,
  EDGE_PAD,
} from "./constants/layouts";
import TextStyleControls, { TEXT_SECTION } from "./components/Sidebar/TextStyleControls";
import { THEMES, resolveTheme } from "./constants/themes";

import SizeSelector from "./components/Sidebar/SizeSelector";
import LayoutPicker from "./components/Sidebar/LayoutPicker";
import ChannelSwitch from "./components/Sidebar/ChannelSwitch";
import ColorField from "./components/ui/ColorField";
import ContentEditor from "./components/Sidebar/ContentEditor";
import ModuleToggles from "./components/Sidebar/ModuleToggles";
import GradientEditor from "./components/Sidebar/GradientEditor";
import ImageUploader from "./components/Sidebar/ImageUploader";
import ImageAdjustPanel from "./components/Sidebar/ImageAdjustPanel";
import KurlyLogo from "./components/ui/KurlyLogo";
import BannerPreview from "./components/Canvas/BannerPreview";
import CanvasToolbar from "./components/Canvas/CanvasToolbar";
import GenerationHistory from "./components/History/GenerationHistory";

import { buildFilename, exportBatchZip, renderBannerBlob } from "./lib/exportImage";
import { downloadBlob, slugify } from "./lib/download";
import { fileToDataUrl, loadImage, makeThumbnail, normalizeUpload } from "./lib/imageUtils";
import { DEFAULT_TRANSFORM, isTransformed } from "./lib/imageTransform";
import { detectExpandMethod, expandBackground } from "./lib/imageExpand";
import { contentAwareScale } from "./lib/seamCarve";
import { DEFAULT_GRADIENT } from "./lib/gradient";
import { TRANSPARENT, isTransparent } from "./lib/color";
import { detectProvider, removeBackground } from "./lib/removeBackground";
import { measureSlots, sameBox, unionBox } from "./lib/slotGeometry";

const EMPTY_OFFSETS = {};

/** 툴바 + 미리보기를 담는 카드 — DS Card 보다 한 단 큰 라운드(16)를 화면 틀에 쓴다 */
const canvasCard = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-xl)",
  overflow: "hidden",
};

/**
 * BannerBuilder
 *
 * 배너 편집 화면 전체. 첫 진입은 빌더를 고르는 HomePage 이고(App.jsx),
 * 거기서 "모듈러 배너 빌더" 를 고르면 이 화면으로 들어온다.
 * onBack 은 목록으로 돌아가는 콜백 — 라우팅은 App.jsx 가 쥔다.
 */
export default function BannerBuilder({ onBack }) {
  // 지면(웹/앱) — 사이즈·레이아웃 목록을 모두 이 값으로 가른다
  const [channel, setChannel] = useState("web");
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedLayout, setSelectedLayout] = useState("wide-editorial");
  const [selectedTheme, setSelectedTheme] = useState("purple");
  const [themeOverrides, setThemeOverrides] = useState({});
  // 포토 오버레이 레이아웃에서 사진 위에 얹는 리니어 그라데이션
  const [gradient, setGradient] = useState({ ...DEFAULT_GRADIENT });
  const [modules, setModules] = useState({ ...DEFAULT_MODULES });
  const [content, setContent] = useState({ ...CONTENT_DEFAULTS });

  // 텍스트 배치/정렬/두께 — 레이아웃(수직 구성)과 독립적으로 사용자가 정한다
  const [textPosition, setTextPosition] = useState(LAYOUTS[0].block.position);
  const [textAlign, setTextAlign] = useState(LAYOUTS[0].block.align);
  const [textWeight, setTextWeight] = useState("regular");
  const [tagStyle, setTagStyle] = useState("text");

  // 레이아웃별 슬롯 오프셋: { [layoutId]: { [moduleId]: {dx, dy} } }
  const [offsetsByLayout, setOffsetsByLayout] = useState({});
  // "none" | "slots" | "crop"
  const [editMode, setEditMode] = useState("none");
  const [selectedSlot, setSelectedSlot] = useState(null);

  // 상품 이미지 + 누끼
  const [image, setImage] = useState(null);
  const [bgProvider, setBgProvider] = useState(detectProvider());
  const [bgStatus, setBgStatus] = useState({ running: false, ratio: 0, label: "" });

  // 배경 확장 / 내용 인식 비율
  const [expandDirs, setExpandDirs] = useState({ right: true, left: false, top: false, bottom: false });
  const [expandAmount, setExpandAmount] = useState(0.4);
  const [expandMethod, setExpandMethod] = useState(detectExpandMethod());
  const [editStatus, setEditStatus] = useState({ running: false, ratio: 0, label: "" });
  // 캐러셀 인디케이터는 배너 이미지에 굽지 않고 미리보기에서 위치 확인용으로만 표시
  const [showIndicator, setShowIndicator] = useState(true);

  // Export
  const [exportFormat, setExportFormat] = useState("png");
  const [exportScale, setExportScale] = useState(2);
  const [exportStatus, setExportStatus] = useState(null);

  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);

  const layoutData = LAYOUTS.find((l) => l.id === selectedLayout) || LAYOUTS[0];
  // 캐러셀 인디케이터는 앱 홈 메인 배너를 그 규격(1125×840)으로 만들 때만 의미가 있다.
  // 규격이 다르면 좌표가 실제 지면과 어긋나므로 토글 자체를 내린다.
  const indicatorAvailable =
    Boolean(layoutData.indicator) && selectedSize.id === layoutData.recommendedSize;
  const currentOffsets = offsetsByLayout[selectedLayout] || EMPTY_OFFSETS;
  const effectiveTheme = resolveTheme(selectedTheme, themeOverrides);

  /**
   * 색 한 줄 (역할 하나) — 역할 드롭다운을 없애고 각 섹션 안에 바로 놓는다.
   * 배경색은 "배경 이미지" 카드 맨 위, 글자·태그·CTA 색은 "콘텐츠 입력" 카드 아래.
   */
  const colorField = (key, label, extra = {}) => (
    <ColorField
      key={key}
      label={label}
      value={effectiveTheme[key]}
      overridden={themeOverrides[key] !== undefined}
      onChange={(hex) => setColorOverride(key, hex)}
      onReset={() => clearColorOverride(key)}
      {...extra}
    />
  );
  // 템플릿에 슬롯이 있는 모듈의 색만 보여 준다 — 안 쓰는 역할을 늘어놓지 않는다
  const textColorRoles = [
    (layoutData.slots.title || layoutData.slots.eventTag) && ["text", "타이틀"],
    (layoutData.slots.subtitle || layoutData.slots.date) && ["sub", "서브 텍스트"],
    layoutData.slots.discount && ["accent", "강조 (할인)"],
    layoutData.slots.eventTag && tagStyle === "badge" && ["badge", "태그 배경"],
    layoutData.slots.eventTag && tagStyle === "badge" && ["badgeText", "태그 글자"],
    layoutData.cta && ["cta", "CTA 배경"],
    layoutData.cta && ["ctaText", "CTA 글자"],
  ].filter(Boolean);
  const textColorFields = textColorRoles.length
    ? textColorRoles.map(([key, label]) => colorField(key, label))
    : null;
  const bgColorControl = colorField("bg", "배경색", {
    allowNone: true,
    onToggleNone: () =>
      isTransparent(effectiveTheme.bg) ? clearColorOverride("bg") : setColorOverride("bg", TRANSPARENT),
  });

  const movedCount = useMemo(
    () => Object.values(currentOffsets).filter((o) => o && (o.dx || o.dy)).length,
    [currentOffsets],
  );

  // 이미지는 어떤 레이아웃에서도 배경으로 합성되므로, 업로드만 되어 있으면 조정 가능
  const imageAvailable = Boolean(image?.src);
  const transform = image?.transform || DEFAULT_TRANSFORM;
  const transformChanged = isTransformed(transform);

  // Crop 대상이 사라지면 편집 모드를 자동 해제
  useEffect(() => {
    if (editMode === "image" && !imageAvailable) setEditMode("none");
  }, [editMode, imageAvailable]);

  const showToast = useCallback((message, tone = "success") => {
    setToast({ message, tone, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ---------------------------------------------------------------- */
  /* 기본 설정 조작                                                    */
  /* ---------------------------------------------------------------- */

  const toggleModule = (id) => setModules((prev) => ({ ...prev, [id]: !prev[id] }));
  const updateContent = (key, val) => setContent((prev) => ({ ...prev, [key]: val }));

  const handleLayoutSelect = (layoutId) => {
    const next = LAYOUTS.find((l) => l.id === layoutId);
    setSelectedLayout(layoutId);
    setSelectedSlot(null);
    // 템플릿마다 어울리는 배치/정렬이 있어 선택 시 함께 적용한다 (이후 자유 변경 가능)
    if (next) {
      setTextPosition(next.block.position);
      setTextAlign(next.block.align);
      // 할인율을 크게 쓰는 템플릿은 해당 모듈을 켜 준다 (꺼져 있으면 빈 화면이 된다)
      if ((next.slots.discount?.scale || 1) >= 1.3) {
        setModules((prev) => ({ ...prev, discount: true }));
      }
      // 앱 팝업/캐러셀은 지면 규격이 정해져 있어 함께 맞춘다
      const recommended = SIZES.find((size) => size.id === next.recommendedSize);
      if (recommended && recommended.id !== selectedSize.id) {
        setSelectedSize(recommended);
        showToast(`${next.name} 규격(${recommended.w}×${recommended.h})으로 맞췄습니다`);
      }
    }
  };

  /**
   * 규격 선택 → 그 규격을 권장하는 템플릿까지 함께 적용.
   *
   * 규격만 바뀌고 템플릿이 남아 있으면 "권장 규격을 쓰세요" 안내만 뜨고
   * 사용자가 템플릿을 한 번 더 눌러야 했다. 규격을 고르는 행위 자체가
   * "이 지면을 만들겠다"는 뜻이라 템플릿을 바로 맞춰 준다.
   * 전용 템플릿이 없는 규격(앱 카테고리 등)은 지금 템플릿을 그대로 쓴다.
   */
  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    const paired = LAYOUTS.find((l) => l.channel === size.channel && l.recommendedSize === size.id);
    if (!paired || paired.id === selectedLayout) return;
    setSelectedLayout(paired.id);
    setSelectedSlot(null);
    setTextPosition(paired.block.position);
    setTextAlign(paired.block.align);
    showToast(`${size.label} 규격에 맞춰 "${paired.name}" 템플릿을 적용했습니다`);
  };

  const handleChannelChange = (next) => {
    if (next === channel) return;
    setChannel(next);
    // 다른 지면의 템플릿/규격은 그대로 쓸 수 없어 해당 지면의 기본값으로 옮긴다
    const layout = LAYOUTS.find((l) => l.channel === next);
    const size =
      SIZES.find((sz) => sz.id === layout?.recommendedSize) || SIZES.find((sz) => sz.channel === next);
    if (layout) {
      setSelectedLayout(layout.id);
      setTextPosition(layout.block.position);
      setTextAlign(layout.block.align);
    }
    if (size) setSelectedSize(size);
    setSelectedSlot(null);
  };

  const handleThemeSelect = (themeId) => {
    setSelectedTheme(themeId);
    // 테마를 바꾸면 직접 지정한 색은 초기화한다 (섞이면 결과를 예측하기 어렵다)
    setThemeOverrides({});
  };

  const setColorOverride = (key, hex) => setThemeOverrides((prev) => ({ ...prev, [key]: hex }));

  const patchGradient = (patch) => setGradient((prev) => ({ ...prev, ...patch }));

  const clearColorOverride = (key) =>
    setThemeOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleOffsetChange = useCallback(
    (moduleId, delta) => {
      setOffsetsByLayout((prev) => {
        const layoutOffsets = prev[selectedLayout] || {};
        return {
          ...prev,
          [selectedLayout]: { ...layoutOffsets, [moduleId]: delta },
        };
      });
    },
    [selectedLayout],
  );

  /* ---------------------------------------------------------------- */
  /* 정렬 · 위치 (Figma Design 패널)                                   */
  /* ---------------------------------------------------------------- */

  // 지금 화면에 실제로 그려지는 텍스트 모듈
  const visibleSlotIds = useMemo(
    () => MODULE_DEFS.filter((m) => modules[m.id] && layoutData.slots[m.id]).map((m) => m.id),
    [modules, layoutData],
  );

  // 대상 = 고른 슬롯 하나, 안 골랐으면 블록 전체
  const alignTargets = useMemo(
    () =>
      selectedSlot && visibleSlotIds.includes(selectedSlot) ? [selectedSlot] : visibleSlotIds,
    [selectedSlot, visibleSlotIds],
  );

  // 폰트·줄바꿈이 반영된 실제 박스는 계산으로 못 얻는다 → 미리보기 DOM 을 측정
  const measureTargets = useCallback(() => {
    const rects = measureSlots(alignTargets, selectedSize);
    return rects ? unionBox(rects) : null;
  }, [alignTargets, selectedSize]);

  // 표시용 X / Y. 정렬 계산은 이 값이 아니라 클릭 시점의 실측을 쓴다
  // (연속 클릭 때 한 박자 늦은 값으로 계산하면 어긋난다).
  const [alignBox, setAlignBox] = useState(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setAlignBox((prev) => {
        const next = measureTargets();
        return sameBox(prev, next) ? prev : next;
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, [
    measureTargets,
    selectedLayout,
    currentOffsets,
    content,
    textPosition,
    textAlign,
    textWeight,
    tagStyle,
  ]);

  /** 대상 슬롯들의 오프셋을 같은 양(%)만큼 함께 민다 */
  const nudgeOffsets = useCallback(
    (ids, ddx, ddy) => {
      setOffsetsByLayout((prev) => {
        const cur = prev[selectedLayout] || {};
        const next = { ...cur };
        ids.forEach((id) => {
          const o = cur[id] || {};
          next[id] = {
            dx: +((o.dx || 0) + ddx).toFixed(2),
            dy: +((o.dy || 0) + ddy).toFixed(2),
          };
        });
        return { ...prev, [selectedLayout]: next };
      });
    },
    [selectedLayout],
  );

  /**
   * Figma 처럼 "한 번 누르면 옮기는" 정렬.
   * 블록 전체의 가로 정렬만은 오프셋이 아니라 레이아웃 앵커(textPosition)로 처리한다.
   * 그래야 규격을 바꿔도 정렬이 유지되고, 오프셋이 0 으로 남아 초기화 상태가 깔끔하다.
   */
  const handleAlign = useCallback(
    (axis, mode) => {
      const blockWide = alignTargets.length > 1 || !selectedSlot;
      if (axis === "x" && blockWide) {
        setTextPosition(mode === "center" ? "center" : mode === "start" ? "left" : "right");
        setOffsetsByLayout((prev) => {
          const cur = prev[selectedLayout] || {};
          const next = { ...cur };
          alignTargets.forEach((id) => {
            next[id] = { dx: 0, dy: cur[id]?.dy || 0 };
          });
          return { ...prev, [selectedLayout]: next };
        });
        return;
      }
      const box = measureTargets();
      if (!box) return;

      const total = axis === "x" ? selectedSize.w : selectedSize.h;
      const pad = (total * EDGE_PAD) / 100;
      const from = axis === "x" ? box.x : box.y;
      const len = axis === "x" ? box.w : box.h;
      const to =
        mode === "start" ? pad : mode === "center" ? (total - len) / 2 : total - pad - len;
      const delta = ((to - from) / total) * 100;
      nudgeOffsets(alignTargets, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
    },
    [alignTargets, measureTargets, nudgeOffsets, selectedLayout, selectedSlot, selectedSize],
  );

  /** X / Y 직접 입력 — 배너 좌상단 기준 px */
  const handlePositionInput = useCallback(
    (axis, value) => {
      const box = measureTargets();
      if (!box || !Number.isFinite(value)) return;
      const total = axis === "x" ? selectedSize.w : selectedSize.h;
      const clamped = Math.max(-total, Math.min(total * 2, value));
      const from = axis === "x" ? box.x : box.y;
      const delta = ((clamped - from) / total) * 100;
      nudgeOffsets(alignTargets, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
    },
    [alignTargets, measureTargets, nudgeOffsets, selectedSize],
  );

  const resetOffsets = () => {
    setOffsetsByLayout((prev) => ({ ...prev, [selectedLayout]: {} }));
    showToast("슬롯 위치를 레이아웃 기본값으로 되돌렸습니다");
  };

  /* ---------------------------------------------------------------- */
  /* 이미지 업로드 · Crop · 누끼                                       */
  /* ---------------------------------------------------------------- */

  const patchImage = useCallback((patch) => setImage((prev) => (prev ? { ...prev, ...patch } : prev)), []);

  const handleTransformChange = useCallback(
    (next) => patchImage({ transform: next }),
    [patchImage],
  );

  const resetTransform = () => {
    patchImage({ transform: { ...DEFAULT_TRANSFORM } });
    showToast("배경 이미지 위치·크기를 초기화했습니다");
  };

  const handleUpload = async (file) => {
    try {
      const raw = await fileToDataUrl(file);
      const normalized = await normalizeUpload(raw);
      setImage({
        name: file.name,
        // baseSrc = 업로드 원본. 확장/비율 편집은 src 만 바꾸므로 언제든 되돌릴 수 있다
        baseSrc: normalized.dataUrl,
        baseSize: { w: normalized.w, h: normalized.h },
        src: normalized.dataUrl,
        srcSize: { w: normalized.w, h: normalized.h },
        cutoutSrc: null,
        cutoutSize: null,
        useCutout: false,
        fit: "cover",
        transform: { ...DEFAULT_TRANSFORM },
        region: null,
        edits: [],
      });
      setBgStatus({ running: false, ratio: 0, label: "" });
      showToast("배경 이미지를 업로드했습니다");
    } catch (err) {
      showToast(err.message || "이미지 업로드에 실패했습니다", "error");
    }
  };

  const handleRemoveBackground = async () => {
    if (!image?.src) return;
    setBgStatus({ running: true, ratio: 0, label: "준비 중" });
    try {
      const result = await removeBackground(image.src, {
        provider: bgProvider,
        region: image.region,
        onProgress: ({ ratio, label }) => setBgStatus({ running: true, ratio, label }),
      });
      const cutout = await loadImage(result.dataUrl);
      setImage((prev) =>
        prev
          ? {
              ...prev,
              cutoutSrc: result.dataUrl,
              cutoutSize: { w: cutout.naturalWidth, h: cutout.naturalHeight },
              useCutout: true,
              // 누끼 상품컷은 잘리면 안 되므로 전체가 보이도록 맞춘다
              fit: "contain",
              // 누끼로 이미지 경계가 바뀌므로 위치·크기는 기본값으로 초기화한다
              transform: { ...DEFAULT_TRANSFORM },
            }
          : prev,
      );
      setBgStatus({ running: false, ratio: 1, label: "", warning: result.warning });
      showToast(result.warning ? "누끼 완료 — 결과를 확인해 주세요" : "배경을 제거했습니다");
    } catch (err) {
      setBgStatus({ running: false, ratio: 0, label: "", error: err.message });
      showToast("배경 제거에 실패했습니다", "error");
    }
  };

  const revertCutout = () => {
    patchImage({
      cutoutSrc: null,
      cutoutSize: null,
      useCutout: false,
      fit: "cover",
      transform: { ...DEFAULT_TRANSFORM },
    });
    setBgStatus({ running: false, ratio: 0, label: "" });
    showToast("누끼를 취소하고 원본으로 되돌렸습니다");
  };

  /**
   * 편집 결과를 새 소스로 교체한다.
   * 누끼는 이전 소스 기준이라 무효가 되므로 함께 비운다.
   */
  const applyEditedSource = (result, label) => {
    setImage((prev) =>
      prev
        ? {
            ...prev,
            src: result.dataUrl,
            srcSize: { w: result.w, h: result.h },
            cutoutSrc: null,
            cutoutSize: null,
            useCutout: false,
            fit: "cover",
            transform: { ...DEFAULT_TRANSFORM },
            edits: [...(prev.edits || []), label],
          }
        : prev,
    );
  };

  const toggleExpandDir = (id) => setExpandDirs((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleExpand = async () => {
    if (!image?.src) return;
    setEditStatus({ running: true, ratio: 0, label: "준비 중" });
    try {
      const margins = {};
      for (const key of ["left", "right", "top", "bottom"]) {
        if (expandDirs[key]) margins[key] = expandAmount;
      }
      const result = await expandBackground(image.src, {
        margins,
        method: expandMethod,
        onProgress: ({ ratio, label }) => setEditStatus({ running: true, ratio, label }),
      });
      applyEditedSource(result, `배경 확장 +${Math.round(expandAmount * 100)}%`);
      setEditStatus({ running: false, ratio: 1, label: "", warning: result.warning });
      showToast(`배경을 확장했습니다 (${result.w}×${result.h}px)`);
    } catch (err) {
      setEditStatus({ running: false, ratio: 0, label: "", error: err.message });
      showToast("배경 확장에 실패했습니다", "error");
    }
  };

  const handleContentAwareScale = async () => {
    if (!image?.src) return;
    setEditStatus({ running: true, ratio: 0, label: "준비 중" });
    try {
      const result = await contentAwareScale(image.src, {
        targetRatio: selectedSize.w / selectedSize.h,
        onProgress: ({ ratio, label }) => setEditStatus({ running: true, ratio, label }),
      });
      if (!result.changed) {
        setEditStatus({ running: false, ratio: 0, label: "", warning: "이미 목표 비율에 가깝습니다." });
        return;
      }
      applyEditedSource(result, "내용 인식 비율");
      setEditStatus({ running: false, ratio: 1, label: "", warning: result.warning });
      showToast(`비율을 조정했습니다 (${result.w}×${result.h}px)`);
    } catch (err) {
      setEditStatus({ running: false, ratio: 0, label: "", error: err.message });
      showToast("비율 조정에 실패했습니다", "error");
    }
  };

  const revertImageEdits = () => {
    setImage((prev) =>
      prev
        ? {
            ...prev,
            src: prev.baseSrc,
            srcSize: prev.baseSize,
            cutoutSrc: null,
            cutoutSize: null,
            useCutout: false,
            fit: "cover",
            transform: { ...DEFAULT_TRANSFORM },
            edits: [],
          }
        : prev,
    );
    setEditStatus({ running: false, ratio: 0, label: "" });
    showToast("업로드 원본으로 되돌렸습니다");
  };

  const clearImage = () => {
    setImage(null);
    setBgStatus({ running: false, ratio: 0, label: "" });
    setEditStatus({ running: false, ratio: 0, label: "" });
    setEditMode((prev) => (prev === "image" ? "none" : prev));
  };

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  const buildConfig = useCallback(
    (size) => ({
      size,
      layout: selectedLayout,
      theme: selectedTheme,
      themeOverrides,
      gradient,
      content,
      modules,
      offsets: currentOffsets,
      image,
      textPosition,
      textAlign,
      textWeight,
      tagStyle,
    }),
    [
      selectedLayout,
      selectedTheme,
      themeOverrides,
      gradient,
      content,
      modules,
      currentOffsets,
      image,
      textPosition,
      textAlign,
      textWeight,
      tagStyle,
    ],
  );

  const createEntry = (size, blob, thumb) => ({
    id: `${Date.now()}-${size.id}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    title: content.title,
    sizeLabel: size.label,
    layoutName: LAYOUTS.find((l) => l.id === selectedLayout)?.name,
    themeName: THEMES.find((t) => t.id === selectedTheme)?.name,
    format: exportFormat,
    scale: exportScale,
    filename: buildFilename({
      content,
      layoutId: selectedLayout,
      themeId: selectedTheme,
      size,
      format: exportFormat,
    }),
    blob,
    thumb,
    // "설정 복원"용 스냅샷
    snapshot: {
      size,
      layout: selectedLayout,
      theme: selectedTheme,
      themeOverrides: { ...themeOverrides },
      gradient: { ...gradient },
      content: { ...content },
      modules: { ...modules },
      offsets: { ...currentOffsets },
      image,
      textPosition,
      textAlign,
      textWeight,
      tagStyle,
    },
  });

  const notifyBackgroundWait = () =>
    setExportStatus((prev) => ({
      ...(prev || {}),
      label: "탭이 백그라운드 상태입니다 — 이 탭을 활성화하면 계속 진행됩니다",
    }));

  const handleGenerate = async () => {
    setExportStatus({ ratio: 0.1, label: `${selectedSize.label} 렌더링 중` });
    try {
      const blob = await renderBannerBlob(buildConfig(selectedSize), {
        format: exportFormat,
        scale: exportScale,
        onWaitForVisible: notifyBackgroundWait,
      });
      const entry = createEntry(selectedSize, blob, await makeThumbnail(blob));
      const saved = await downloadBlob(blob, entry.filename);
      // 결과는 히스토리에 남겨 둔다 — 저장을 거절해도 다시 내려받을 수 있다
      setHistory((prev) => [entry, ...prev].slice(0, 30));
      showToast(
        saved === "declined"
          ? "저장을 취소했습니다 — 생성 히스토리에서 다시 내려받을 수 있습니다"
          : `${entry.filename} 다운로드 완료`,
      );
    } catch (err) {
      console.error(err);
      showToast(err.message || "배너 생성에 실패했습니다", "error");
    } finally {
      setExportStatus(null);
    }
  };

  const handleBatchGenerate = async () => {
    setExportStatus({ ratio: 0, label: "일괄 생성 준비 중" });
    try {
      const { zipBlob, items } = await exportBatchZip({
        sizes: batchSizes,
        config: buildConfig(selectedSize),
        layoutId: selectedLayout,
        themeId: selectedTheme,
        format: exportFormat,
        scale: exportScale,
        onProgress: ({ ratio, label, current, total }) => setExportStatus({ ratio, label, current, total }),
        onWaitForVisible: notifyBackgroundWait,
      });

      const zipName = `${slugify(content.title)}_${selectedLayout}_${batchSizes.length}종.zip`;
      const saved = await downloadBlob(zipBlob, zipName);

      const entries = items.map((item) => createEntry(item.size, item.blob, item.thumb));
      setHistory((prev) => [...entries, ...prev].slice(0, 30));
      showToast(
        saved === "declined"
          ? "저장을 취소했습니다 — 생성 히스토리에서 낱장으로 내려받을 수 있습니다"
          : `${items.length}종 배너를 ZIP으로 내려받았습니다`,
      );
    } catch (err) {
      console.error(err);
      showToast(err.message || "일괄 생성에 실패했습니다", "error");
    } finally {
      setExportStatus(null);
    }
  };

  const handleHistoryDownload = async (entry) => {
    if (!entry.blob) return;
    await downloadBlob(entry.blob, entry.filename);
  };

  const handleHistoryRestore = (entry) => {
    const snap = entry.snapshot;
    if (!snap) return;
    setSelectedSize(SIZES.find((s) => s.id === snap.size.id) || snap.size);
    setSelectedLayout(snap.layout);
    setSelectedTheme(snap.theme);
    setThemeOverrides(snap.themeOverrides || {});
    setGradient(snap.gradient || { ...DEFAULT_GRADIENT });
    setContent(snap.content);
    setModules(snap.modules);
    setOffsetsByLayout((prev) => ({ ...prev, [snap.layout]: snap.offsets }));
    setImage(snap.image);
    if (snap.textPosition) setTextPosition(snap.textPosition);
    if (snap.textAlign) setTextAlign(snap.textAlign);
    if (snap.textWeight) setTextWeight(snap.textWeight);
    if (snap.tagStyle) setTagStyle(snap.tagStyle);
    showToast("해당 배너의 설정을 불러왔습니다");
  };

  // 일괄 Export 범위 — 앱 레이아웃으로 웹 규격을 뽑는 건 의미가 없어 채널로 제한한다
  const batchSizes = sizesByChannel(channel);
  const batchLabel = LAYOUT_CHANNELS.find((c) => c.id === channel)?.label || "";

  const busy = Boolean(exportStatus);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-surface)" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--color-card)",
          borderBottom: "1px solid var(--color-border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "var(--header-height)",
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* 컬리 워드마크 = 빌더 목록으로 돌아가는 자리 (사이트 로고의 관례) */}
          <button
            type="button"
            onClick={onBack}
            title="빌더 목록으로"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 0,
              border: "none",
              background: "none",
              color: "var(--color-brand)",
              cursor: onBack ? "pointer" : "default",
            }}
          >
            <KurlyLogo height={22} />
            <span
              aria-hidden="true"
              style={{ width: 1, height: 20, background: "var(--color-border)" }}
            />
          </button>
          <div>
            {/* 제목은 DS headline2(17/24), 부제는 caption2(11/14) — 자간은 variant 가 가져간다 */}
            <div
              className="ty-headline2"
              style={{
                fontWeight: "var(--font-weight-bold)",
                color: "var(--color-text-primary)",
              }}
            >
              모듈러 배너 빌더
            </div>
            <div className="ty-caption2" style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-medium)" }}>
              프로모션 에셋 자동 생성 시스템 v0.4
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={busy}
            className="ty-label2"
            /* DS Button md — r10 · 좌우 20 · 높이 40. 비활성은 interaction-disable 면 + label-disable 글자 */
            style={{
              height: "var(--control-height-md)",
              padding: "0 20px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: busy ? "var(--color-disable-bg)" : "var(--color-primary)",
              color: busy ? "var(--color-text-disable)" : "var(--color-on-primary)",
              fontWeight: "var(--font-weight-bold)",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            생성 + 다운로드
          </button>
          <button
            onClick={handleBatchGenerate}
            disabled={busy}
            className="ty-label2"
            style={{
              height: "var(--control-height-md)",
              padding: "0 20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-card)",
              color: "var(--color-text-primary)",
              fontWeight: "var(--font-weight-bold)",
              opacity: busy ? 0.5 : 1,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {batchLabel} 전체 ZIP · {batchSizes.length}종
          </button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className="ty-label1"
          /* DS Snackbar 톤 — 상태색은 semantic status 토큰, 라운드는 12 */
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background:
              toast.tone === "error"
                ? "var(--color-danger)"
                : toast.tone === "warn"
                  ? "var(--color-warning)"
                  : "var(--color-success)",
            color: "var(--semantic-static-white)",
            padding: "10px 20px",
            borderRadius: "var(--radius-lg)",
            fontWeight: "var(--font-weight-medium)",
            zIndex: 100,
            boxShadow: "var(--shadow-toast)",
            animation: "toastIn 0.3s ease",
            maxWidth: "70vw",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Export 진행 오버레이 */}
      {exportStatus && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-dimmer)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 320,
              background: "var(--color-card)",
              borderRadius: "var(--radius-xl)",
              padding: 24,
              boxShadow: "var(--shadow-pop)",
            }}
          >
            <div className="ty-headline2" style={{ fontWeight: "var(--font-weight-bold)", marginBottom: 4 }}>
              배너 생성 중
            </div>
            <div className="ty-label2" style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>
              {exportStatus.label}
              {exportStatus.total ? ` · ${exportStatus.current}/${exportStatus.total}` : ""}
            </div>
            <div
              style={{
                height: 6,
                background: "var(--color-fill-strong)",
                borderRadius: "var(--radius-full)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((exportStatus.ratio || 0) * 100)}%`,
                  height: "100%",
                  background: "var(--color-primary)",
                  transition: "width 0.25s",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/*
        Main Layout — Montage 의 화면 틀: 회색 면 위에 라운드 16 카드들을 띄우고
        카드 사이는 spacing-16 으로 벌린다. 패널에 테두리선 하나만 긋던
        원본과 달리, 면이 끊기는 자리를 카드 경계가 맡는다.
      */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 16, padding: 16 }}>
        {/* Content Area */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, gap: 16 }}>
          <div style={canvasCard}>
          <CanvasToolbar
            editMode={editMode}
            onEditModeChange={(mode) => {
              setEditMode(mode);
              setSelectedSlot(null);
            }}
            imageAvailable={imageAvailable}
            movedCount={movedCount}
            onResetOffsets={resetOffsets}
            onResetTransform={resetTransform}
            transformChanged={transformChanged}
            format={exportFormat}
            onFormatChange={setExportFormat}
            scale={exportScale}
            onScaleChange={setExportScale}
            outputSize={{ w: selectedSize.w * exportScale, h: selectedSize.h * exportScale }}
            indicatorAvailable={indicatorAvailable}
            showIndicator={showIndicator}
            onToggleIndicator={() => setShowIndicator((prev) => !prev)}
          />

          <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--color-surface)" }}>
            <BannerPreview
              size={selectedSize}
              sizeLabel={selectedSize.label}
              layout={selectedLayout}
              theme={selectedTheme}
              themeOverrides={themeOverrides}
              gradient={gradient}
              textPosition={textPosition}
              textAlign={textAlign}
              textWeight={textWeight}
              tagStyle={tagStyle}
              content={content}
              modules={modules}
              offsets={currentOffsets}
              image={image}
              showIndicator={showIndicator && indicatorAvailable}
              editMode={editMode}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onOffsetChange={handleOffsetChange}
              onTransformChange={handleTransformChange}
            />
          </div>
          </div>

          <GenerationHistory
            history={history}
            onDownload={handleHistoryDownload}
            onRestore={handleHistoryRestore}
            onClear={() => setHistory([])}
          />
        </main>

        {/* 디자인 패널 — Figma 처럼 오른쪽. 미리보기·툴바가 왼쪽 작업 영역을 차지한다 */}
        <aside
          data-autohide-scroll=""
          style={{
            width: "var(--sidebar-width)",
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <ChannelSwitch channel={channel} onChange={handleChannelChange} />
          <SizeSelector
            selected={selectedSize}
            onSelect={handleSizeSelect}
            channel={channel}
            recommendedId={layoutData.recommendedSize}
            layoutName={layoutData.name}
          />
          <LayoutPicker selected={selectedLayout} onSelect={handleLayoutSelect} channel={channel} />
          {/* 텍스트 카드 — 숨김 (TextStyleControls.jsx 의 TEXT_SECTION.hidden) */}
          {!TEXT_SECTION.hidden && (
            <TextStyleControls
              align={textAlign}
              onAlignChange={setTextAlign}
              weight={textWeight}
              onWeightChange={setTextWeight}
              tagStyle={tagStyle}
              onTagStyleChange={setTagStyle}
              box={alignBox}
              onAlign={handleAlign}
              onPositionChange={handlePositionInput}
              targetLabel={
                selectedSlot
                  ? MODULE_DEFS.find((m) => m.id === selectedSlot)?.label || "선택 모듈"
                  : "텍스트 블록 전체"
              }
              targetIsBlock={!selectedSlot}
              onClearSelection={() => setSelectedSlot(null)}
              showTagStyle={Boolean(layoutData.slots.eventTag)}
            />
          )}
          <ContentEditor content={content} onChange={updateContent} colors={textColorFields} />
          <ImageUploader
            image={image}
            onUpload={handleUpload}
            onChange={patchImage}
            onRemoveBackground={handleRemoveBackground}
            onRevertCutout={revertCutout}
            onClear={clearImage}
            provider={bgProvider}
            onProviderChange={setBgProvider}
            status={bgStatus}
            colorControl={bgColorControl}
          />
          <ImageAdjustPanel
            image={image}
            editing={editMode === "image"}
            onToggleEditing={() => setEditMode((prev) => (prev === "image" ? "none" : "image"))}
            onTransformChange={handleTransformChange}
            bannerSize={selectedSize}
            expandDirs={expandDirs}
            onToggleDir={toggleExpandDir}
            expandAmount={expandAmount}
            onAmountChange={setExpandAmount}
            expandMethod={expandMethod}
            onMethodChange={setExpandMethod}
            onExpand={handleExpand}
            onContentAwareScale={handleContentAwareScale}
            onRevertEdits={revertImageEdits}
            status={editStatus}
            onReset={resetTransform}
            resetDisabled={!transformChanged}
          />
          {image?.src && (
            <GradientEditor gradient={gradient} theme={effectiveTheme} onChange={patchGradient} />
          )}
          <ModuleToggles modules={modules} onToggle={toggleModule} layout={layoutData} />
        </aside>

      </div>
    </div>
  );
}
