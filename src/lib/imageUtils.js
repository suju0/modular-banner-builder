/**
 * 이미지 로딩 / 캔버스 유틸
 *
 * 업로드된 상품 이미지는 dataURL 로 다루어
 * html-to-image 로 캡처할 때 CORS 문제가 발생하지 않도록 한다.
 */

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    img.src = src;
  });
}

export function blobToDataUrl(blob) {
  return fileToDataUrl(blob);
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** 캔버스 생성 (OffscreenCanvas 미사용 — 2D 컨텍스트 호환성 우선) */
export function createCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

/**
 * 업로드 이미지를 적정 해상도로 축소.
 * 4000px 원본을 그대로 들고 있으면 프리뷰/Export 가 급격히 느려진다.
 */
export async function normalizeUpload(dataUrl, maxSide = 1600) {
  const img = await loadImage(dataUrl);
  const side = Math.max(img.naturalWidth, img.naturalHeight);
  if (side <= maxSide) {
    return { dataUrl, w: img.naturalWidth, h: img.naturalHeight };
  }
  const ratio = maxSide / side;
  const canvas = createCanvas(img.naturalWidth * ratio, img.naturalHeight * ratio);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
}

/**
 * 투명 여백 잘라내기.
 * 누끼 결과를 슬롯에 꽉 차게 배치하기 위해 사용한다.
 */
export function trimTransparent(canvas, alphaThreshold = 8) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let top = height,
    left = width,
    right = -1,
    bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaThreshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < 0) return canvas; // 전부 투명 — 원본 유지

  const pad = 2;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const w = right - left + 1;
  const h = bottom - top + 1;
  if (w === width && h === height) return canvas;

  const out = createCanvas(w, h);
  out.getContext("2d").drawImage(canvas, left, top, w, h, 0, 0, w, h);
  return out;
}

/** Blob → 축소 썸네일 dataURL (히스토리 패널용) */
export async function makeThumbnail(blob, maxW = 240) {
  const dataUrl = await blobToDataUrl(blob);
  const img = await loadImage(dataUrl);
  const ratio = Math.min(1, maxW / img.naturalWidth);
  const canvas = createCanvas(img.naturalWidth * ratio, img.naturalHeight * ratio);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** 노드 안의 모든 <img> 로딩 완료를 기다린다 (Export 정확도) */
export async function waitForImages(node) {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }),
  );
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* 폰트 로딩 실패는 무시 — 폴백 폰트로 렌더 */
    }
  }
}
