/**
 * 배너 사이즈 프리셋
 *
 * 채널(웹 / 앱)로 분류한다. 앱 규격은 실제 노출 지면 기준이라 웹과 비율이 완전히
 * 달라서(팝업은 세로형, 히어로는 4:3에 가깝다) 섞어 두면 잘못 고르기 쉽다.
 */

export const SIZE_CHANNELS = [
  { id: "web", label: "웹" },
  { id: "app", label: "앱" },
];

export const SIZES = [
  // ---------------- 웹 ----------------
  { id: "pc-full", channel: "web", label: "PC 풀배너", w: 1920, h: 360, desc: "웹 메인 최상단" },
  { id: "pc-hero", channel: "web", label: "PC 히어로", w: 1200, h: 400, desc: "웹 중단 프로모션" },
  { id: "sns-square", channel: "web", label: "SNS 정사각", w: 1080, h: 1080, desc: "인스타그램 피드" },

  // ---------------- 앱 ----------------
  // ① 앱 진입 모달 팝업 — 세로형, 라운드 코너, 하단 CTA 바
  { id: "app-modal", channel: "app", label: "앱 모달 팝업", w: 1080, h: 1240, desc: "앱 진입 팝업" },
  // ② 앱 홈 메인 배너 (캐러셀) — 지정 규격
  { id: "app-hero", channel: "app", label: "앱 홈 메인", w: 1125, h: 840, desc: "홈 캐러셀 배너" },
  // ③ 하단 시트형 팝업 — 상단만 라운드 (올리브영 하단 시트 배너 규격)
  { id: "app-sheet", channel: "app", label: "앱 하단 시트", w: 1125, h: 880, desc: "하단 시트 팝업" },
  { id: "app-category", channel: "app", label: "앱 카테고리", w: 720, h: 240, desc: "카테고리 상단" },
  { id: "app-push", channel: "app", label: "앱 푸시", w: 720, h: 360, desc: "푸시 알림 이미지" },
];

/** 채널별 사이즈 목록 (일괄 Export 범위 계산에 사용) */
export function sizesByChannel(channel) {
  return SIZES.filter((s) => s.channel === channel);
}
