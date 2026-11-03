/**
 * PNG 에 sRGB 색공간을 명시한다.
 *
 * 왜 필요한가
 * Canvas.toBlob 이 만든 PNG 에는 **색공간 태그가 없다.** 브라우저는 태그 없는
 * 이미지를 sRGB 로 보지만, 뷰어·디자인 툴 중에는 모니터 프로파일로 해석하는 것이
 * 있어서 같은 픽셀값(95,0,128)이 화면에서 미묘하게 다른 색으로 보인다.
 * "미리보기와 추출물 색이 살짝 다르다"의 정체가 이것이다 — 숫자는 같은데
 * 해석이 갈린 것이다.
 *
 * 그래서 픽셀은 한 비트도 건드리지 않고 **"이 숫자들은 sRGB 다"라는 표시만** 붙인다.
 * 색 관리를 하는 뷰어는 이제 브라우저와 똑같이 sRGB → 모니터 변환을 하게 된다.
 *
 * 붙이는 청크 (PNG 명세상 IHDR 뒤, IDAT 앞)
 *   sRGB — 렌더링 인텐트 0(perceptual)
 *   gAMA — 45455 (= 1/2.2). sRGB 를 모르는 오래된 디코더용
 *   cHRM — sRGB 표준 원색 좌표. 같은 이유
 */

/** PNG 청크 CRC — 다항식 0xEDB88320, 테이블은 최초 1회만 만든다 */
let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 청크 1개 = [길이 4][타입 4][데이터][CRC 4] */
function makeChunk(type, data) {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

function u32(...values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setUint32(i * 4, value));
  return bytes;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** sRGB 표준 원색 (백점 D65) — 명세가 정한 값 ×100000 */
const SRGB_CHROMATICITY = u32(31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000);

/**
 * @param {Blob} blob canvas 가 만든 PNG
 * @returns {Promise<Blob>} sRGB 태그가 붙은 PNG. 실패하면 원본을 그대로 돌려준다
 *   (색 태그는 있으면 좋은 것이지, Export 를 실패시킬 이유는 아니다)
 */
export async function tagPngAsSrgb(blob) {
  try {
    const src = new Uint8Array(await blob.arrayBuffer());
    if (!PNG_SIGNATURE.every((byte, i) => src[i] === byte)) return blob;

    // IHDR 은 시그니처(8) 다음의 첫 청크이고 길이가 13으로 고정이라 끝이 8+25
    const insertAt = 8 + 25;
    const view = new DataView(src.buffer, src.byteOffset);
    const ihdrType = String.fromCharCode(...src.subarray(12, 16));
    if (ihdrType !== "IHDR" || view.getUint32(8) !== 13) return blob;

    // 이미 태그가 있으면 건드리지 않는다
    const head = String.fromCharCode(...src.subarray(8, Math.min(src.length, 4096)));
    if (head.includes("sRGB") || head.includes("iCCP")) return blob;

    const tags = [
      makeChunk("gAMA", u32(45455)),
      makeChunk("cHRM", SRGB_CHROMATICITY),
      makeChunk("sRGB", new Uint8Array([0])),
    ];

    return new Blob([src.subarray(0, insertAt), ...tags, src.subarray(insertAt)], {
      type: "image/png",
    });
  } catch (err) {
    console.warn("[export] sRGB 태그 삽입 실패 — 원본 PNG 를 그대로 사용합니다.", err);
    return blob;
  }
}
