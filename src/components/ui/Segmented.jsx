/**
 * Segmented — Montage SegmentedControl 규격을 그대로 옮긴 세그먼트 컨트롤.
 *
 * segmented-control/style.ts 의 3단:
 *   lg 48 / 트랙 r12 / 패딩 3 / 아이템 r10
 *   md 40 / 트랙 r10 / 패딩 2 / 아이템 r8
 *   sm 32 / 트랙 r8  / 패딩 2 / 아이템 r6
 * 트랙은 테두리 없이 fill 로만 구분하고, 선택된 알약은 흰 면 + elevation xsmall.
 *
 * options: [{ id, label, desc? }]
 * inline: 툴바처럼 가로로 줄 세우는 자리 — 폭을 나눠 갖지 않고 글자 길이대로 눕는다.
 */
const SIZES = {
  sm: { h: 32, pad: 2, track: "var(--radius-sm)", item: "var(--radius-xs)", ty: "ty-caption1" },
  md: { h: 40, pad: 2, track: "var(--radius-md)", item: "var(--radius-sm)", ty: "ty-label2" },
  lg: { h: 48, pad: 3, track: "var(--radius-lg)", item: "var(--radius-md)", ty: "ty-label1" },
};

export default function Segmented({ options, value, onChange, size = "md", inline = false, ariaLabel }) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: inline ? "inline-flex" : "flex",
        gap: 2,
        padding: s.pad,
        height: s.h,
        borderRadius: s.track,
        background: "var(--color-fill)",
        flexShrink: 0,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.desc}
            onClick={() => onChange(opt.id)}
            className={s.ty}
            style={{
              flex: inline ? "0 0 auto" : 1,
              minWidth: 0,
              height: "100%",
              /* DS SegmentedControl 의 아이템 좌우 패딩은 16 — 폭을 나눠 갖는
                 꽉 찬 모드에서만 8 로 좁혀 글자가 잘리지 않게 한다 */
              padding: inline ? "0 16px" : "0 8px",
              borderRadius: s.item,
              border: "none",
              background: active ? "var(--color-card)" : "transparent",
              boxShadow: active ? "var(--shadow-card)" : "none",
              color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
              fontWeight: active ? "var(--font-weight-bold)" : "var(--font-weight-medium)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
