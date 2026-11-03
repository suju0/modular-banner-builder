import { LAYOUT_CHANNELS } from "../../constants/layouts";
import Segmented from "../ui/Segmented";

/**
 * ChannelSwitch
 *
 * 웹 / 앱 지면 선택. 이 값이 사이즈 프리셋과 레이아웃 템플릿 목록을 모두 가른다.
 * 두 채널을 한 번에 보여주면 목록이 길고 잘못 고르기 쉬워서 한쪽만 노출한다.
 *
 * 세그먼트는 직접 그리지 않고 ui/Segmented(=DS SegmentedControl 규격)를 쓴다.
 * 같은 모양을 두 벌 유지하면 한쪽만 DS 를 따라가는 일이 생긴다.
 */
export default function ChannelSwitch({ channel, onChange }) {
  return (
    <div
      style={{
        padding: "12px var(--panel-gutter) var(--spacing-16)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        className="ty-label1"
        style={{
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-text-primary)",
          marginBottom: 10,
        }}
      >
        지면
      </div>
      <Segmented
        options={LAYOUT_CHANNELS.map((c) => ({ id: c.id, label: c.label }))}
        value={channel}
        onChange={onChange}
        size="md"
        ariaLabel="지면 선택"
      />
    </div>
  );
}
