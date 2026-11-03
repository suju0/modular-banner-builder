/**
 * 스크롤하는 동안에만 스크롤바를 보여 준다.
 *
 * `data-autohide-scroll` 이 붙은 요소를 대상으로, 스크롤이 일어나면
 * `data-scrolling` 을 달고 멈춘 뒤 HIDE_DELAY 가 지나면 뗀다.
 * 보이고 숨는 것은 CSS 가 한다 (globals.css 의 `::-webkit-scrollbar-thumb`).
 *
 * 두 가지를 의도적으로 이렇게 했다.
 * - scroll 이벤트는 **버블링하지 않는다.** 그래서 document 에 capture 로 단다.
 *   컨테이너마다 리스너를 붙이면 패널이 늘 때마다 빠뜨리기 쉽다.
 * - 스크롤바 **폭(8px)은 늘 차지하고 색만 바뀐다.** 폭까지 접으면 보일 때마다
 *   내용이 8px 씩 밀려 글이 흔들린다.
 */

const HIDE_DELAY = 1200;
const ATTR = "data-autohide-scroll";
const ACTIVE = "data-scrolling";

const timers = new WeakMap();

export function installAutoHideScrollbars() {
  if (typeof document === "undefined") return;

  document.addEventListener(
    "scroll",
    (event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || !el.hasAttribute(ATTR)) return;

      el.setAttribute(ACTIVE, "");
      clearTimeout(timers.get(el));
      timers.set(
        el,
        setTimeout(() => el.removeAttribute(ACTIVE), HIDE_DELAY),
      );
    },
    true, // capture — scroll 은 버블링하지 않는다
  );
}
