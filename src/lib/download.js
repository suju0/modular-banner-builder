/**
 * 브라우저 다운로드 헬퍼
 *
 * 두 가지 환경을 모두 지원한다.
 *
 * 1) 일반 브라우저(로컬 dev / Vercel) — `<a download>` 로 바로 내려받는다.
 * 2) Claude 아티팩트 — 뷰어 샌드박스가 페이지가 스스로 시작한 다운로드를
 *    (blob:·data: 포함) 막는다. 대신 플랫폼이 주는 `downloads` capability 로
 *    파일을 건네면 뷰어에게 확인을 받고 저장한다.
 *
 * capability 는 `claude.use()` 가 비동기로 해결하고, 없으면 null 이 온다.
 * 그래서 "있으면 쓰고 없으면 <a download>" 한 길로 합쳐 두었다 —
 * 호출부(App.jsx)는 어느 환경인지 알 필요가 없다.
 */

/** 안전한 파일명으로 정리 (한글 유지, 파일시스템 금지문자 제거) */
export function slugify(text, fallback = "banner") {
  const cleaned = String(text || "")
    .trim()
    .replace(/[\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return cleaned || fallback;
}

/**
 * 아티팩트 저장 채널. 한 번만 조회해 캐시한다.
 * 아티팩트가 아니면 계속 null 이라 곧바로 `<a download>` 로 빠진다.
 */
let savePromise;
function getArtifactSaver() {
  if (savePromise === undefined) {
    const use = typeof window !== "undefined" && window.claude?.use;
    savePromise = use
      ? Promise.resolve(window.claude.use("downloads")).catch(() => null)
      : Promise.resolve(null);
  }
  return savePromise;
}

/**
 * @returns {Promise<"saved"|"declined"|"error">} 뷰어가 거절해도 예외를 던지지 않는다.
 *   호출부는 결과로 토스트 문구만 바꾸면 된다.
 */
export async function downloadBlob(blob, filename) {
  const saver = await getArtifactSaver();

  if (saver) {
    try {
      await saver.save({ filename, data: blob });
      return "saved";
    } catch (err) {
      // 사용자가 "아니오"를 눌렀거나 프롬프트가 만료된 경우 — 재시도하지 않는다
      if (err?.code === "declined") return "declined";
      // 그 밖의 실패는 일반 경로로 한 번 더 시도해 본다
      console.warn("[download] capability 저장 실패, 링크 방식으로 재시도", err);
    }
  }

  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  // revoke는 클릭 처리 이후로 미룬다 (즉시 해제하면 일부 브라우저에서 실패)
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}

function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
