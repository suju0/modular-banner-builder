/**
 * dist/index.html → dist/artifact.html
 *
 * Claude 아티팩트는 올린 파일을 자기 <!doctype>/<head>/<body> 뼈대 안에 끼워 넣는다.
 * Vite 가 만든 완전한 문서를 그대로 올리면 문서가 이중으로 감싸이므로,
 * <head>/<body> 안쪽만 뽑아 한 조각으로 만든다. 자산 참조(./assets/...)는
 * vite.config.js 의 base:'./' 덕분에 상대 경로라 그대로 쓰면 된다.
 *
 * 사용법:  npm run build && node scripts/build-artifact.mjs
 * 출력물:  dist/artifact.html  (+ dist/assets/* 를 함께 업로드)
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const html = readFileSync(join(DIST, "index.html"), "utf8");

const pick = (tag) => html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "";
const head = pick("head").trim();
const body = pick("body").trim();

if (!head || !body) {
  throw new Error("dist/index.html 구조가 예상과 다릅니다 — 먼저 npm run build 를 실행하세요.");
}

// 뼈대가 이미 charset/viewport 를 넣어 주므로 그 둘은 뺀다
const kept = head
  .split("\n")
  .filter((line) => !/<meta\s+(charset|name="viewport")/i.test(line))
  .join("\n");

writeFileSync(join(DIST, "artifact.html"), `${kept}\n${body}\n`, "utf8");

const assets = readdirSync(join(DIST, "assets"));
console.log("dist/artifact.html 생성 완료");
console.log("함께 올릴 파일:", assets.map((f) => `assets/${f}`).join(", "));
