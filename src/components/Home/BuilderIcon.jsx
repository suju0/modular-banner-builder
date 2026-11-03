/**
 * 빌더 목록용 선 아이콘
 *
 * 이모지를 쓰지 않는다는 규칙(CLAUDE.md)에 따라 직접 그린다.
 * 20×20 그리드 · 선 굵기 1.6 · 둥근 끝으로 톤을 통일했다.
 * 새 아이콘을 추가할 때도 같은 규격을 지킬 것.
 */
const line = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
};

const SHAPES = {
  /* 배너 — 가로 프레임 + 텍스트 두 줄 */
  banner: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" {...line} />
      <path d="M5.5 9h6M5.5 12h3.5" {...line} />
    </>
  ),
  /* 레이어 — 섹션 머리표 */
  layers: (
    <>
      <path d="M10 2.8 17.2 6.6 10 10.4 2.8 6.6Z" {...line} />
      <path d="M2.8 10.4 10 14.2l7.2-3.8" {...line} />
      <path d="M2.8 13.8 10 17.6l7.2-3.8" {...line} />
    </>
  ),
  /* 기획전 — 모듈 그리드 */
  grid: (
    <>
      <rect x="2.8" y="2.8" width="6" height="6" rx="1.4" {...line} />
      <rect x="11.2" y="2.8" width="6" height="6" rx="1.4" {...line} />
      <rect x="2.8" y="11.2" width="6" height="6" rx="1.4" {...line} />
      <rect x="11.2" y="11.2" width="6" height="6" rx="1.4" {...line} />
    </>
  ),
  /* 이미지 소재 */
  image: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" {...line} />
      <circle cx="7.3" cy="8" r="1.4" {...line} />
      <path d="m3.4 14.3 4.2-4 3 2.8 2.6-2.4 3.4 3.2" {...line} />
    </>
  ),
  /* 오른쪽 꺾쇠 — 카드 끝 */
  chevron: <path d="m7.5 4.5 6 5.5-6 5.5" {...line} />,
};

export default function BuilderIcon({ name, size = 20 }) {
  const shape = SHAPES[name] || SHAPES.banner;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {shape}
    </svg>
  );
}
