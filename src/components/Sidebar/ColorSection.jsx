import { useEffect, useRef, useState } from "react";

import { COLOR_ROLES, resolveTheme } from "../../constants/themes";
import { TRANSPARENT, isTransparent, normalizeHex } from "../../lib/color";
import SidebarSection from "../ui/SidebarSection";
import ColorPickerPanel, { RgbInputs } from "../ui/ColorPickerPanel";

/**
 * ColorSection
 *
 * 색을 한 번에 8개 늘어놓지 않고 **역할 하나씩** 고쳐 쓰는 형태.
 * 행 구성: [색 점] [# HEX 입력] [기본값]
 * 점을 누르면 Figma 식 인라인 피커(채도·명도 + 색상 슬라이더)가 펼쳐진다.
 */

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(-45deg, var(--semantic-line-solid-normal) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--semantic-line-solid-normal) 75%), linear-gradient(-45deg, transparent 75%, var(--semantic-line-solid-normal) 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
  backgroundColor: "var(--semantic-static-white)",
};

const selectStyle = {
  width: "100%",
  height: "var(--control-height-md)",
  padding: "0 12px",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--color-border)",
  fontSize: "var(--font-label2-size)",
  fontWeight: "var(--font-weight-bold)",
  background: "var(--color-card)",
  color: "var(--color-text-primary)",
  marginBottom: 8,
};

/**
 * 드롭다운으로 역할을 골라 색을 바꾸던 "컬러" 섹션 — 지금은 숨김.
 * 색 지정은 쓰이는 섹션 안으로 옮겼다: 배경색은 "배경", 글자·태그·CTA 색은 "텍스트" (ColorField).
 * 다시 쓰려면 아래 hidden: true 만 지우면 된다.
 */
export const COLOR_SECTION = { hidden: true };

export default function ColorSection({ theme, overrides, onChange, onReset, onResetAll, roles, defaults }) {
  // 템플릿이 고를 수 있는 역할을 제한하면(퀵 메뉴 = 배경만) 그 역할만 보여 준다
  const roleList = roles?.length ? COLOR_ROLES.filter((r) => roles.includes(r.key)) : COLOR_ROLES;
  const [roleKey, setRoleKey] = useState(COLOR_ROLES[0].key);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  const role = roleList.find((r) => r.key === roleKey) || roleList[0];
  const effective = resolveTheme(theme, overrides, defaults);
  const value = effective[role.key];
  const none = isTransparent(value);
  const overridden = Boolean(overrides?.[role.key]);
  const overriddenRoles = roleList.filter((r) => overrides?.[r.key]);

  useEffect(() => setDraft(none ? "" : value.replace("#", "")), [value, none]);

  // 바깥 클릭 시 피커 닫기
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const commitHex = (raw) => {
    const normalized = normalizeHex(raw);
    if (!normalized) {
      setError("HEX 6자리로 입력해 주세요");
      return;
    }
    setError(null);
    onChange(role.key, normalized);
  };

  return (
    <SidebarSection title="컬러">
      <div ref={rootRef}>
        <select value={role.key} onChange={(e) => setRoleKey(e.target.value)} style={selectStyle}>
          {roleList.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
              {overrides?.[r.key] ? " ●" : ""}
            </option>
          ))}
        </select>

        {/* [점] [HEX] [기본값] */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setOpen((prev) => !prev)}
            aria-label={`${role.label} 색 선택`}
            style={{
              width: "var(--control-height-sm)",
              height: "var(--control-height-sm)",
              borderRadius: "50%",
              flexShrink: 0,
              border: open ? "2px solid var(--color-primary)" : "1px solid var(--color-border-alpha)",
              ...(none ? CHECKER : { background: value }),
            }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0 12px",
              height: "var(--control-height-md)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
            }}
          >
            <span style={{ fontSize: "var(--font-label2-size)", color: "var(--color-text-muted)" }}>#</span>
            <input
              value={none ? "" : draft}
              placeholder={none ? "지정 안 함" : "5F0080"}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => draft && commitHex(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitHex(draft);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                fontSize: "var(--font-label2-size)",
                fontWeight: "var(--font-weight-bold)",
                fontFamily: "inherit",
                fontVariantNumeric: "tabular-nums",
                background: "transparent",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
          <button
            onClick={() => onReset(role.key)}
            disabled={!overridden}
            style={{
              padding: "0 20px",
              height: "var(--control-height-md)",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${overridden ? "var(--color-border-strong)" : "var(--color-border)"}`,
              background: overridden ? "var(--color-card)" : "var(--color-disable-bg)",
              fontSize: "var(--font-label2-size)",
              fontWeight: "var(--font-weight-bold)",
              color: overridden ? "var(--color-primary-text)" : "var(--color-text-disable)",
              flexShrink: 0,
            }}
          >
            기본값
          </button>
        </div>

        <div style={{ fontSize: "var(--font-caption2-size)", color: "var(--color-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          {error || role.desc}
        </div>

        {open && (
          <div
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <ColorPickerPanel
              value={value}
              onChange={(hex) => onChange(role.key, hex)}
              onEyedropError={setError}
            />
            <div style={{ marginTop: 10 }}>
              <RgbInputs value={value} onChange={(hex) => onChange(role.key, hex)} />
            </div>
          </div>
        )}

        {role.allowNone && (
          <button
            onClick={() => onChange(role.key, TRANSPARENT)}
            disabled={none}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "8px 0",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: none ? "var(--color-primary-light)" : "var(--color-card)",
              fontSize: "var(--font-caption1-size)",
              fontWeight: "var(--font-weight-bold)",
              color: none ? "var(--color-primary-text)" : "var(--color-text-primary)",
            }}
          >
            {none ? "배경 없음 (투명) 적용됨" : "배경 없음 (투명)"}
          </button>
        )}

        {/* 지정한 색 요약 */}
        {overriddenRoles.length > 0 && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {overriddenRoles.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setRoleKey(r.key);
                  setOpen(false);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: "var(--font-caption2-size)",
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "1px solid var(--color-border-alpha)",
                    ...(isTransparent(overrides[r.key]) ? CHECKER : { background: overrides[r.key] }),
                  }}
                />
                {r.label}
              </button>
            ))}
            {/* 색은 템플릿마다 따로 저장된다 — 지금 템플릿에서 바꾼 색만 기본값으로 */}
            <button
              onClick={onResetAll}
              title="지금 템플릿에서 바꾼 색만 기본값으로 되돌립니다"
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                fontSize: "var(--font-caption2-size)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--color-text-muted)",
              }}
            >
              이 템플릿 초기화
            </button>
          </div>
        )}
      </div>
    </SidebarSection>
  );
}
