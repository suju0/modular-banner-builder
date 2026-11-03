/**
 * 빌더 레지스트리
 *
 * 첫 화면(HomePage)에 깔리는 목록의 **유일한 원본**이다.
 * 빌더를 새로 만들면 여기 한 줄만 추가하면 홈에 순서대로 붙는다 —
 * 홈 컴포넌트는 이 배열을 그대로 그릴 뿐 아무것도 알지 않는다.
 *
 * 그룹
 * - id      : 내부 식별자
 * - label   : 섹션 제목
 * - icon    : BuilderIcon 의 키
 * - builders: 이 섹션에 속한 빌더들 (배열 순서 = 노출 순서)
 *
 * 빌더
 * - id      : 내부 식별자
 * - name    : 카드 제목
 * - desc    : 카드 설명 — 무엇을 뽑는 도구인지 한 줄로
 * - icon    : BuilderIcon 의 키
 * - route   : 해시 경로 (#/<route>). status 가 "planned" 면 비워 둔다
 * - status  : "live" | "planned" — planned 는 흐리게 + "예정" 뱃지, 클릭 불가
 *
 * 새 빌더를 붙이는 순서
 *   1) 여기 항목 추가 (route 는 새 해시 경로)
 *   2) App.jsx 의 ROUTES 에 route → 컴포넌트 연결
 */
export const BUILDER_GROUPS = [
  {
    id: "onsite",
    label: "운영 배너",
    icon: "layers",
    builders: [
      {
        id: "banner",
        name: "모듈러 배너 빌더",
        desc: "웹·앱 지면 규격별 프로모션 배너 생성 · PNG / JPG · 일괄 ZIP 추출",
        icon: "banner",
        route: "banner",
        status: "live",
      },
    ],
  },
];

/** 사이드바 카운트 — 상태별 빌더 수 */
export function countBuilders(status) {
  return BUILDER_GROUPS.reduce(
    (total, group) => total + group.builders.filter((b) => b.status === status).length,
    0,
  );
}

/** 해시 경로로 빌더 찾기 (없으면 null → 홈으로 떨어진다) */
export function findBuilderByRoute(route) {
  for (const group of BUILDER_GROUPS) {
    const hit = group.builders.find((b) => b.status === "live" && b.route === route);
    if (hit) return hit;
  }
  return null;
}
