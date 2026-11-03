/**
 * 빠른 선택 (포토샵 '빠른 선택 도구'와 같은 감각)
 *
 * 브러시로 칠한 지점의 평균색을 기준으로, 비슷한 색의 이웃 픽셀로 선택을 넓힌다.
 * 강한 경계(색 기울기)를 만나면 멈추고, 한 번 칠할 때 넓어지는 범위는 브러시 반경의 8배로
 * 제한한다 — 제한이 없으면 배경과 피사체 색이 비슷할 때 한 번에 화면 전체가 잡힌다.
 *
 * 작업은 모달에 보이는 해상도(최대 640px)에서 한다. 최종 마스크는 원본 크기로
 * 부드럽게 확대해 쓰므로(removeBackground.viaMask) 경계가 자연스럽게 페더링된다.
 */

const DIM = [17, 24, 39, 140]; // 선택 밖 — 어둡게
const FILL = [157, 217, 79, 46]; // 선택 안 — 옅은 그린
const EDGE = [157, 217, 79, 255]; // 선택 경계선

export class QuickSelectMask {
  constructor(img, w, h) {
    this.w = w;
    this.h = h;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const n = w * h;
    this.r = new Uint8ClampedArray(n);
    this.g = new Uint8ClampedArray(n);
    this.b = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) {
      this.r[i] = data[i * 4];
      this.g[i] = data[i * 4 + 1];
      this.b[i] = data[i * 4 + 2];
    }
    this.mask = new Uint8Array(n);
    this.edge = this.#edges();
    // 방문 표시는 칠할 때마다 세대 번호만 올려 재사용한다 (배열 재할당 없음)
    this.seen = new Uint32Array(n);
    this.stamp = 0;
    this.queue = new Int32Array(n);
    this.overlay = null;
  }

  /** 소벨 기울기 크기 (0–255 근사) — 경계에서 선택 확산을 멈추는 데 쓴다 */
  #edges() {
    const { w, h, r, g, b } = this;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
    const out = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx =
          lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
        const gy =
          lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
        out[i] = Math.min(255, Math.sqrt(gx * gx + gy * gy) / 4);
      }
    }
    return out;
  }

  /**
   * (x, y) 에 반경 radius 브러시 한 번.
   * @param {{subtract?: boolean, tolerance?: number}} opts tolerance = 허용 색 거리 (6–80)
   */
  paint(x, y, radius, { subtract = false, tolerance = 28 } = {}) {
    const { w, h, r, g, b, mask, edge, seen, queue } = this;
    const cx = Math.round(x);
    const cy = Math.round(y);
    const rad = Math.max(1, Math.round(radius));
    const value = subtract ? 0 : 1;
    const stamp = ++this.stamp;

    // 1) 브러시 원 안: 무조건 칠하고 기준색을 구한다
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let count = 0;
    let head = 0;
    let tail = 0;
    for (let dy = -rad; dy <= rad; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= h) continue;
      for (let dx = -rad; dx <= rad; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= w || dx * dx + dy * dy > rad * rad) continue;
        const i = py * w + px;
        sr += r[i];
        sg += g[i];
        sb += b[i];
        count++;
        mask[i] = value;
        seen[i] = stamp;
        queue[tail++] = i;
      }
    }
    if (!count) return;
    sr /= count;
    sg /= count;
    sb /= count;

    // 2) 비슷한 색으로 확산 — 반경 8배까지, 강한 경계에서 정지
    const limit = rad * 8;
    const limit2 = limit * limit;
    const tol2 = tolerance * tolerance * 3;
    const edgeStop = 40 + tolerance;
    while (head < tail) {
      const i = queue[head++];
      const px = i % w;
      const py = (i - px) / w;
      for (let k = 0; k < 4; k++) {
        const nx = k === 0 ? px - 1 : k === 1 ? px + 1 : px;
        const ny = k === 2 ? py - 1 : k === 3 ? py + 1 : py;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (seen[j] === stamp) continue;
        seen[j] = stamp;
        const ddx = nx - cx;
        const ddy = ny - cy;
        if (ddx * ddx + ddy * ddy > limit2) continue;
        if (edge[j] > edgeStop) continue;
        const er = r[j] - sr;
        const eg = g[j] - sg;
        const eb = b[j] - sb;
        if (er * er + eg * eg + eb * eb > tol2) continue;
        mask[j] = value;
        queue[tail++] = j;
      }
    }
  }

  clear() {
    this.mask.fill(0);
  }

  coverage() {
    let c = 0;
    for (let i = 0; i < this.mask.length; i++) c += this.mask[i];
    return c / this.mask.length;
  }

  /** 모달 오버레이 — 밖은 어둡게, 안은 옅은 그린, 경계는 진한 그린 */
  drawOverlay(ctx) {
    const { w, h, mask } = this;
    if (!this.overlay) this.overlay = ctx.createImageData(w, h);
    const d = this.overlay.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let c;
        if (!mask[i]) c = DIM;
        else {
          const border =
            (x > 0 && !mask[i - 1]) || (x < w - 1 && !mask[i + 1]) || (y > 0 && !mask[i - w]) || (y < h - 1 && !mask[i + w]);
          c = border ? EDGE : FILL;
        }
        const p = i * 4;
        d[p] = c[0];
        d[p + 1] = c[1];
        d[p + 2] = c[2];
        d[p + 3] = c[3];
      }
    }
    ctx.putImageData(this.overlay, 0, 0);
  }

  /** 저장된 마스크(dataURL) 다시 불러오기 — "다시 선택" 시 이어서 다듬을 수 있다 */
  async load(dataUrl) {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, this.w, this.h);
    const d = ctx.getImageData(0, 0, this.w, this.h).data;
    for (let i = 0; i < this.mask.length; i++) this.mask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  }

  /**
   * 적용 — 선택 안쪽의 막힌 구멍을 메우고(상품 라벨·하이라이트가 빠지는 것 방지)
   * 흰색 = 남김 인 알파 마스크 PNG 와 정규화 바운딩 박스를 돌려준다.
   */
  finalize() {
    const { w, h, mask, queue } = this;
    const outside = new Uint8Array(w * h);
    let head = 0;
    let tail = 0;
    const push = (i) => {
      if (outside[i] || mask[i]) return;
      outside[i] = 1;
      queue[tail++] = i;
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < w * (h - 1)) push(i + w);
    }
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < mask.length; i++) {
      if (!outside[i]) mask[i] = 1;
      if (mask[i]) {
        const x = i % w;
        const y = (i - x) / w;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const out = ctx.createImageData(w, h);
    for (let i = 0; i < mask.length; i++) {
      const p = i * 4;
      out.data[p] = 255;
      out.data[p + 1] = 255;
      out.data[p + 2] = 255;
      out.data[p + 3] = mask[i] ? 255 : 0;
    }
    ctx.putImageData(out, 0, 0);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      bounds:
        x1 < 0
          ? null
          : { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h },
    };
  }
}
