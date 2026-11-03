/**
 * Toggle — 원본 빌더(5173)의 토글 그대로.
 *
 * DS Switch(sm: 트랙 44×26 · 썸 20)로 한 번 키웠다가, 모듈 표시 카드의
 * 밀도가 원본만 못해 **원본 규격(36×20 · 썸 16)으로 되돌렸다.**
 * 색만 두 가지가 다르다.
 *   켜짐 — 포인트 컬러(컬리 퍼플 #5F0080)
 *   꺼짐 — `--color-toggle-off` (globals.css 에 고른 이유를 적어 뒀다).
 *          세그먼트 트랙과 같은 톤이면 흰 카드 위에서 윤곽이 사라지고,
 *          한 단 올리면 꺼진 상태 치고 무겁다. 그 사이 한 칸이다.
 */
export default function Toggle({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        padding: "5px 0",
      }}
    >
      <div
        onClick={onChange}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "var(--color-primary)" : "var(--color-toggle-off)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            background: "var(--semantic-static-white)",
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(var(--semantic-static-black-rgb), 0.15)",
          }}
        />
      </div>
      <span
        className="ty-caption1"
        style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" }}
      >
        {label}
      </span>
    </label>
  );
}
