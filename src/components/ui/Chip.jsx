/** 투명(미지정) 스와치용 체커 패턴 — 선 톤은 DS 의 solid line 을 쓴다 */
const CHECKER =
  "linear-gradient(45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(-45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--semantic-line-solid-normal) 75%), linear-gradient(-45deg, transparent 75%, var(--semantic-line-solid-normal) 75%)";

/**
 * Chip — Montage Chip(outlined) 규격을 따른다.
 *
 * DS 의 Chip 은 알약이 아니라 **라운드 사각형**이다 (chip/style.ts):
 *   xs r6 p4/7 · sm r8 p6/8 · md r8 p7/11 · lg r10 p9/12
 * 여기서는 md 를 쓴다. 선택 상태는 primary 알파 선 + blue-95 바탕으로,
 * 두께를 바꾸지 않아 선택해도 줄바꿈이 밀리지 않는다.
 */
export default function Chip({ selected, onClick, children, color, transparentSwatch = false }) {
  return (
    <button
      onClick={onClick}
      className="ty-caption1"
      style={{
        padding: "7px 11px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${selected ? "var(--color-primary-line)" : "var(--color-border-strong)"}`,
        background: selected ? "var(--color-primary-light)" : "var(--color-card)",
        color: selected ? "var(--color-primary-text)" : "var(--color-text-secondary)",
        fontWeight: selected ? "var(--font-weight-bold)" : "var(--font-weight-medium)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {(color || transparentSwatch) && (
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            display: "inline-block",
            border: "1px solid var(--color-border-alpha)",
            ...(transparentSwatch
              ? {
                  backgroundImage: CHECKER,
                  backgroundSize: "6px 6px",
                  backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
                  backgroundColor: "var(--semantic-static-white)",
                }
              : { background: color }),
          }}
        />
      )}
      {children}
    </button>
  );
}
