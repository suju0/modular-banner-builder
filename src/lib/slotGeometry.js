/**
 * 슬롯 실측 좌표 (banner px)
 *
 * 정렬과 X/Y 입력은 "글자가 실제로 차지한 박스"를 알아야 한다.
 * 폰트·자간·줄바꿈까지 반영된 값은 계산으로 추정할 수 없어서
 * 미리보기 DOM 을 그대로 측정한다 (Figma 가 바운딩 박스를 쓰는 것과 같은 방식).
 *
 * 미리보기는 CSS transform 으로 축소돼 있으므로 루트 폭과 원본 규격의 비로
 * 배율을 역산해 배너 좌표계(px)로 환산한다.
 * Export 는 화면 밖에 별도 트리를 만들기 때문에, 반드시 미리보기 루트
 * (data-preview-banner) 안에서만 찾는다.
 */

const ROOT_SELECTOR = "[data-preview-banner]";

/** @returns {Record<string, {x,y,w,h}>|null} 하나도 못 재면 null */
export function measureSlots(moduleIds, size) {
  if (typeof document === "undefined" || !moduleIds?.length) return null;
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return null;

  const rootRect = root.getBoundingClientRect();
  const scale = rootRect.width / size.w;
  if (!(scale > 0)) return null;

  const rects = {};
  moduleIds.forEach((id) => {
    const el = root.querySelector(`[data-slot-id="${id}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    rects[id] = {
      x: (r.left - rootRect.left) / scale,
      y: (r.top - rootRect.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  });

  return Object.keys(rects).length ? rects : null;
}

/** 여러 슬롯을 감싸는 최소 사각형 — 블록 전체를 한 덩어리로 움직일 때 쓴다 */
export function unionBox(rects) {
  const list = Array.isArray(rects) ? rects : Object.values(rects || {});
  if (!list.length) return null;
  const x = Math.min(...list.map((r) => r.x));
  const y = Math.min(...list.map((r) => r.y));
  const right = Math.max(...list.map((r) => r.x + r.w));
  const bottom = Math.max(...list.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** 측정값은 소수점이 미세하게 흔들려서, 0.5px 이내 변화는 같은 값으로 본다 */
export function sameBox(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) < 0.5);
}
