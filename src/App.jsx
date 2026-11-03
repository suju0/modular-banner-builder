import { useEffect, useState } from "react";

import { findBuilderByRoute } from "./constants/builders";
import { prewarmFontEmbed } from "./lib/exportImage";
import HomePage from "./components/Home/HomePage";
import BannerBuilder from "./BannerBuilder";

/**
 * App — 라우터
 *
 * 첫 화면은 편집기가 아니라 **빌더를 고르는 목록**(HomePage)이다.
 * 빌더가 늘어날 것을 전제로 한 구조라, 여기서 하는 일은 두 가지뿐이다.
 *   1) 주소의 해시를 읽어 어떤 빌더를 띄울지 고른다
 *   2) 빌더에게 목록으로 돌아가는 콜백을 넘긴다
 *
 * 해시 라우팅을 쓰는 이유: 정적 호스팅(아티팩트·Vercel)에서 서버 설정 없이
 * 뒤로가기·새로고침·딥링크가 그대로 동작한다. 라우터 라이브러리는 화면이
 * 두 종류뿐인 지금 단계에 과하다.
 *
 * 빌더를 추가하는 법
 *   1) constants/builders.js 에 항목 추가 (route 지정)
 *   2) 아래 ROUTES 에 route → 컴포넌트 연결
 */
const ROUTES = {
  banner: BannerBuilder,
};

/** "#/banner" → "banner" · 없으면 "" (홈) */
function readRoute() {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#\/?/, "").trim();
}

export default function App() {
  const [route, setRoute] = useState(readRoute);

  // Export 용 폰트 임베드(약 2.6MB base64)를 유휴 시점에 미리 계산해 둔다.
  // 빌더가 아니라 **앱 진입 시점**에 거는 이유: 첫 화면이 빌더 목록이라
  // 사용자가 빌더를 고르는 동안 준비가 끝난다.
  useEffect(() => {
    const timer = setTimeout(prewarmFontEmbed, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 브라우저 뒤로/앞으로 가기를 그대로 따른다
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // 등록되지 않은 해시는 홈으로 떨어뜨린다 (오타·삭제된 빌더 링크)
  const builder = findBuilderByRoute(route);
  const Builder = builder ? ROUTES[builder.route] : null;

  const go = (hash) => {
    window.location.hash = hash;
    setRoute(readRoute());
  };

  if (!Builder) {
    return <HomePage onOpen={(b) => go(`/${b.route}`)} />;
  }
  return <Builder onBack={() => go("/")} />;
}
