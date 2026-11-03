/**
 * 배너 이미지 Export
 *
 * 핵심 원칙: **화면에 보이는 프리뷰를 캡처하지 않는다.**
 * 프리뷰는 CSS transform 으로 축소된 상태이고 편집 UI(드래그 핸들/가이드)가 얹혀 있다.
 * 대신 화면 밖 스테이지에 배너를 원본 픽셀 크기(size.w × size.h)로 다시 렌더한 뒤 캡처한다.
 * → 프리뷰 배율과 무관하게 항상 동일한 결과물, 어떤 사이즈든 1:1 정확도.
 */

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getFontEmbedCSS, toBlob, toJpeg } from "html-to-image";
import JSZip from "jszip";

import BannerRenderer from "../components/Canvas/BannerRenderer";
import { resolveTheme } from "../constants/themes";
import { isTransparent } from "./color";
import { dataUrlToBlob, makeThumbnail, waitForImages } from "./imageUtils";
import { tagPngAsSrgb } from "./pngColorProfile";
import { slugify } from "./download";

export const EXPORT_FORMATS = [
  { id: "png", label: "PNG", ext: "png", mime: "image/png", desc: "투명 배경 지원" },
  { id: "jpg", label: "JPG", ext: "jpg", mime: "image/jpeg", desc: "용량 작음" },
];

export const EXPORT_SCALES = [
  { id: 1, label: "1x", desc: "실제 크기" },
  { id: 2, label: "2x", desc: "레티나" },
  { id: 3, label: "3x", desc: "고해상도" },
];

/**
 * 폰트가 실제로 로드될 때까지 기다린다.
 *
 * Pretendard 는 번들 동봉(약 2MB)이고 font-display: swap 이라, 로드 전에는
 * 폴백 폰트로 그려진다. 그 상태에서 캡처하면 자간·글자폭이 달라져 Figma 기준
 * 좌표가 조용히 어긋난다. 그렇다고 Export 를 실패시킬 이유는 없으므로
 * 상한을 두고 기다린 뒤 진행한다.
 */
function waitForFonts(timeoutMs = 5_000) {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  if (document.fonts.status === "loaded") return Promise.resolve();
  return Promise.race([
    document.fonts.ready.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * 폰트 임베드 CSS — 세션 내 1회만 계산하고 재사용한다.
 *
 * html-to-image 는 foreignObject 안에서 외부 폰트를 참조할 수 없어 폰트 파일을
 * base64 로 CSS 에 인라인한다(약 2.6MB). 이게 첫 Export 가 느렸던 원인이라
 * 모듈 스코프에 promise 를 캐시하고, prewarmFontEmbed 로 미리 돌려 둔다.
 *
 * **실패는 캐시하지 않는다.** 예전에는 실패 결과("")까지 캐시돼서, 일시적인
 * fetch 실패 한 번이 그 세션의 모든 Export 를 폴백 폰트로 만들었다.
 */
let fontEmbedPromise = null;

async function computeFontEmbedCSS(node) {
  // 폰트가 로드돼 있어야 @font-face 규칙이 스타일시트에 확정된다
  await waitForFonts();

  // preferredFontFormat 을 **넘기지 않는다.**
  // html-to-image 1.11 의 filterPreferredFontFormat 은 모듈 스코프의 /g 정규식을
  // lastIndex 초기화 없이 exec 하기 때문에, 같은 입력이라도 호출 횟수에 따라
  // src 선언을 통째로 지워 버린다(embed-resources.js:39-53). 그러면 @font-face 는
  // 남는데 폰트 파일이 없어 **조용히 폴백 폰트로** 렌더된다 — 에러도 안 난다.
  // 어차피 @font-face 가 woff2 하나뿐이라 걸러낼 포맷도 없다.
  const css = await getFontEmbedCSS(node);

  // 안전망: 위 이유든 다른 이유든 규칙만 있고 src 가 없으면 폰트가 통째로 빠진 것이다.
  // 조용히 잘못된 결과물을 내보내느니 눈에 띄게 남긴다.
  if (css.includes("@font-face") && !css.includes("src:")) {
    console.warn("[export] 폰트 임베드에 src 가 없습니다 — 폴백 폰트로 렌더될 수 있습니다.");
  }
  return css;
}

function getCachedFontEmbedCSS(node) {
  if (!fontEmbedPromise) {
    fontEmbedPromise = computeFontEmbedCSS(node).catch((err) => {
      console.warn("[export] 폰트 임베드 실패, 폴백 폰트로 렌더합니다.", err);
      fontEmbedPromise = null; // 다음 Export 에서 다시 시도
      return "";
    });
  }
  return fontEmbedPromise;
}

/**
 * 폰트 임베드를 미리 계산해 둔다 (앱 로드 후 유휴 시점 호출).
 * 마케터가 Export 버튼을 누르기 전에 백그라운드로 끝내 두면 체감 대기가 사라진다.
 * 빌더에 들어오기 전(홈 화면)부터 돌려 두므로 보통 클릭 시점엔 이미 준비돼 있다.
 */
export function prewarmFontEmbed() {
  if (typeof document === "undefined") return;
  getCachedFontEmbedCSS(document.body);
}

/**
 * html-to-image 는 첫 호출에서 이미지/폰트 캐시가 비어 있어
 * 결과물이 누락될 수 있는 알려진 이슈가 있다. 세션당 1회 워밍업으로 회피.
 */
let warmedUp = false;

/**
 * 렌더 반영을 기다린다.
 * 탭이 백그라운드일 때 requestAnimationFrame 이 호출되지 않을 수 있으므로
 * 타이머와 경합시켜 Export 가 영구 대기에 빠지지 않게 한다.
 */
function nextPaint() {
  return Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    new Promise((resolve) => setTimeout(resolve, 120)),
  ]);
}

const TIMEOUT = Symbol("capture-timeout");

/** 캡처 1회에 허용하는 시간 */
const ATTEMPT_TIMEOUT = 20_000;
/** 탭 대기까지 포함한 전체 상한 — 이 시간을 넘기면 실패로 끝낸다 */
const TOTAL_TIMEOUT = 90_000;
const MAX_ATTEMPTS = 3;

/** ms 뒤 value 로 resolve (타임아웃 경합용) */
function after(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * 탭이 백그라운드면 렌더가 진행되지 않는다.
 *
 * html-to-image 내부(createImage)가 requestAnimationFrame 으로 완료를 알리는데,
 * 브라우저는 숨겨진 탭에서 rAF 를 호출하지 않는다 → 캡처가 영구 대기에 빠진다.
 * 그래서 캡처 전에 탭이 보이는지 확인하고, 보일 때까지 기다린다.
 *
 * **단, 무한정 기다리지 않는다.** 예전에는 여기에 상한이 없어서, 탭이 끝내
 * 돌아오지 않으면 Export promise 가 영구 pending 으로 남았다 (호출부의
 * finally 도 돌지 않아 진행 표시가 그대로 붙어 있었다).
 *
 * @returns {Promise<boolean>} 시간 안에 보이게 됐는지
 */
function waitUntilVisible(onWait, budgetMs) {
  if (typeof document === "undefined" || !document.hidden) return Promise.resolve(true);
  if (budgetMs <= 0) return Promise.resolve(false);

  onWait?.();
  return new Promise((resolve) => {
    let timer = null;
    const done = (visible) => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handler);
      resolve(visible);
    };
    const handler = () => {
      if (!document.hidden) done(true);
    };
    document.addEventListener("visibilitychange", handler);
    timer = setTimeout(() => done(false), budgetMs);
  });
}

/**
 * 캡처를 실행하되, 탭 전환으로 멈추면 다시 보일 때 재시도한다.
 * (캡처는 DOM 을 읽기만 하는 순수 연산이라 재시도가 안전하다)
 *
 * 설계 포인트
 * - **전체 상한(TOTAL_TIMEOUT)** 이 탭 대기까지 포함한다 → 영구 pending 이 없다.
 * - html-to-image 는 취소 수단이 없어서, 타임아웃된 시도도 백그라운드에서 계속 돈다.
 *   그래서 **버린 시도를 버리지 않고** 다음 라운드의 경합에 함께 넣는다.
 *   느리게라도 끝나면 그 결과를 쓰고, 중복 캡처가 서로의 결과를 덮어쓸 일은 없다
 *   (Promise.race 는 가장 먼저 끝난 하나만 반환하고, 나머지는 아래에서 삼킨다).
 */
async function captureWithVisibilityGuard(
  run,
  { onWait, attempts = MAX_ATTEMPTS, timeoutMs = ATTEMPT_TIMEOUT, totalTimeoutMs = TOTAL_TIMEOUT } = {},
) {
  const deadline = Date.now() + totalTimeoutMs;
  const remaining = () => deadline - Date.now();
  const inFlight = [];

  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (remaining() <= 0) break;

      const visible = await waitUntilVisible(onWait, remaining());
      if (!visible) break; // 탭이 끝내 돌아오지 않았다

      inFlight.push(run());

      const result = await Promise.race([
        // 이전에 타임아웃된 시도도 아직 살아 있을 수 있다 — 먼저 끝나는 쪽을 쓴다
        ...inFlight.map((promise) => promise.catch(() => TIMEOUT)),
        after(Math.min(timeoutMs, Math.max(remaining(), 0)), TIMEOUT),
      ]);
      if (result !== TIMEOUT) return result;

      // 타임아웃 = 사실상 프레임이 오지 않는 상태.
      // 탭이 숨겨졌으면 다시 보일 때까지 기다렸다가, 아니면 곧바로 재시도한다.
      // (창이 다른 창에 완전히 가려진 경우 visibilityState 는 visible 이면서도
      //  rAF 가 멈출 수 있어 hidden 여부만으로 판단하지 않는다)
    }
  } finally {
    // 버려진 시도의 rejection 이 unhandled 로 남지 않게 한다
    inFlight.forEach((promise) => promise.catch(() => {}));
  }

  throw new Error(
    "이미지 캡처가 완료되지 않았습니다. 브라우저 창을 활성화한 상태에서 다시 시도해 주세요.",
  );
}

/** 스테이지에 배너 DOM 이 나타날 때까지 대기 */
async function waitForNode(mount, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (!mount.firstElementChild) {
    if (Date.now() > deadline) throw new Error("배너 렌더에 실패했습니다.");
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return mount.firstElementChild;
}

/** 화면 밖 렌더 스테이지 생성 */
function createStage() {
  const host = document.createElement("div");
  host.setAttribute("data-export-stage", "");
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0px",
    width: "0px",
    height: "0px",
    overflow: "visible",
    pointerEvents: "none",
    opacity: "1",
    zIndex: "-1",
  });
  const mount = document.createElement("div");
  host.appendChild(mount);
  document.body.appendChild(host);

  const root = createRoot(mount);
  return {
    mount,
    root,
    dispose() {
      // React 경고를 피하기 위해 다음 태스크에서 unmount
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    },
  };
}

/**
 * 배너 1장을 원본 크기로 렌더 후 캡처.
 *
 * @param {object} config BannerRenderer props (size, layout, theme, content, modules, offsets, image)
 * @param {{format?: string, scale?: number, quality?: number}} opts
 * @returns {Promise<Blob>}
 */
export async function renderBannerBlob(config, opts = {}) {
  const format = opts.format === "jpg" ? "jpg" : "png";
  const scale = opts.scale || 2;
  const quality = opts.quality ?? 0.95;
  const { size } = config;

  const stage = createStage();
  try {
    const element = createElement(BannerRenderer, { ...config, interactive: false });
    try {
      // 동기 커밋 — 캡처 직전에 DOM 이 확실히 존재하도록
      flushSync(() => stage.root.render(element));
    } catch {
      stage.root.render(element);
    }

    const node = await waitForNode(stage.mount);
    await nextPaint();
    await waitForImages(node);
    const fontEmbedCSS = await getCachedFontEmbedCSS(node);

    const baseOptions = {
      width: size.w,
      height: size.h,
      pixelRatio: scale,
      fontEmbedCSS,
      cacheBust: false,
      // 편집 전용 UI 는 애초에 렌더되지 않지만(interactive:false),
      // 혹시 남아 있어도 결과물에서 제외한다.
      filter: (el) => !(el.dataset && "exportIgnore" in el.dataset),
    };

    // 타임아웃은 호출부에서 조절할 수 있게 열어 둔다 (기본값은 상단 상수)
    const guard = {
      onWait: opts.onWaitForVisible,
      ...(opts.attemptTimeoutMs ? { timeoutMs: opts.attemptTimeoutMs } : {}),
      ...(opts.totalTimeoutMs ? { totalTimeoutMs: opts.totalTimeoutMs } : {}),
    };

    if (!warmedUp) {
      // 첫 캡처는 이미지/폰트 캐시가 비어 결과가 누락될 수 있어 한 번 버린다
      warmedUp = true;
      await captureWithVisibilityGuard(() => toBlob(node, baseOptions).catch(() => null), guard);
    }

    if (format === "jpg") {
      const dataUrl = await captureWithVisibilityGuard(
        () =>
          toJpeg(node, {
            ...baseOptions,
            quality,
            // JPG 는 알파를 지원하지 않으므로 배경 미지정이면 흰색으로 채운다
            backgroundColor: (() => {
              const bg = resolveTheme(config.theme, config.themeOverrides).bg;
              return isTransparent(bg) ? "#FFFFFF" : bg;
            })(),
          }),
        guard,
      );
      return dataUrlToBlob(dataUrl);
    }

    const blob = await captureWithVisibilityGuard(() => toBlob(node, baseOptions), guard);
    if (!blob) throw new Error("이미지 생성에 실패했습니다.");
    // 픽셀은 그대로 두고 "이 값은 sRGB" 라는 표시만 붙인다.
    // 태그가 없으면 뷰어가 모니터 프로파일로 해석해 브라우저에서 보던 색과 어긋난다.
    return tagPngAsSrgb(blob);
  } finally {
    stage.dispose();
  }
}

/** 결과물 파일명 규칙: 타이틀_레이아웃_테마_WxH.ext */
export function buildFilename({ content, layoutId, themeId, size, format }) {
  const ext = format === "jpg" ? "jpg" : "png";
  const title = slugify(content?.title, "banner");
  return `${title}_${layoutId}_${themeId}_${size.w}x${size.h}.${ext}`;
}

/**
 * 여러 사이즈를 순차 렌더하여 ZIP 으로 묶는다.
 *
 * 병렬로 돌리면 폰트 임베드/캔버스 메모리가 동시에 터지므로 의도적으로 직렬 처리한다.
 *
 * @returns {Promise<{zipBlob: Blob, items: Array<{size:object, blob:Blob, filename:string, thumb:string}>}>}
 */
export async function exportBatchZip({
  sizes,
  config,
  layoutId,
  themeId,
  format,
  scale,
  quality,
  onProgress,
  onWaitForVisible,
}) {
  const zip = new JSZip();
  const items = [];
  const total = sizes.length;

  for (let i = 0; i < total; i++) {
    const size = sizes[i];
    onProgress?.({
      current: i,
      total,
      ratio: i / total,
      label: `${size.label} (${size.w}×${size.h}) 생성 중`,
    });

    const blob = await renderBannerBlob({ ...config, size }, { format, scale, quality, onWaitForVisible });
    const filename = buildFilename({ content: config.content, layoutId, themeId, size, format });

    zip.file(filename, blob);
    items.push({ size, blob, filename, thumb: await makeThumbnail(blob) });
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        layout: layoutId,
        theme: themeId,
        format,
        scale,
        content: config.content,
        modules: config.modules,
        files: items.map((it) => ({
          filename: it.filename,
          size: it.size.id,
          width: it.size.w,
          height: it.size.h,
        })),
      },
      null,
      2,
    ),
  );

  onProgress?.({ current: total, total, ratio: 0.98, label: "ZIP 압축 중" });
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  onProgress?.({ current: total, total, ratio: 1, label: "완료" });
  return { zipBlob, items };
}
