# 모듈러 배너 빌더 — Montage 스킨

프로모션 배너를 자동으로 만드는 마케팅디자인 운영 도구입니다.
마케터가 문구와 이미지를 넣으면, 디자이너가 정의한 템플릿·가드레일 규칙에 따라
채널별 배너가 그 자리에서 완성됩니다.

UI 는 원티드 디자인 시스템 **Montage(WDS)** 규격으로 입혔고, 포인트 컬러만
브랜드 퍼플(`#5F0080`)로 교체했습니다.

## 실행

```bash
npm install
npm run dev     # http://localhost:5174
```

```bash
npm run build   # dist/ 로 정적 번들 생성
```

전 기능이 브라우저에서 동작하는 클라이언트 앱이라 서버가 필요 없습니다.
`main` 에 push 하면 GitHub Actions 가 빌드해서 Pages 로 배포합니다
(`.github/workflows/deploy.yml`).

## 무엇을 하는 도구인가

- **레이아웃 템플릿 8종** — 웹 5 / 앱 3. 템플릿마다 권장 규격이 있고,
  비율이 많이 다른 규격을 고르면 화면이 먼저 알려 준다
- **배너 규격 프리셋 8종** — 지면(웹·앱)으로 목록이 갈린다
- **콘텐츠 입력** — 태그·타이틀·서브카피·할인·기간·CTA. 글자 수에 따라 타이틀 크기가 자동 조정된다
- **모듈 토글** — 템플릿에 자리가 없는 모듈은 "미지원"으로 막고, 필수 영역은 끌 수 없다
- **배경 이미지** — 업로드·배경 제거(누끼)·자유 변형·배경 확장·내용 인식 비율
- **색상** — 8개 역할을 HEX / RGB / 스포이드로 직접 지정. 배경은 투명도 지원
- **내보내기** — PNG / JPG, 1x·2x·3x, 지면 전체 일괄 ZIP
- **생성 히스토리** — 썸네일·설정과 함께 남고, 설정을 복원해 그때 상태로 돌아간다

## 구조

```
src/
├── App.jsx              해시 라우터 (홈 ↔ 빌더)
├── BannerBuilder.jsx    편집 화면 — 상태 오케스트레이션
├── constants/           빌더 레지스트리 · 규격 · 레이아웃 · 테마
├── lib/                 Export · 누끼 · 이미지 변형 · 그라데이션 · 색
├── components/
│   ├── Canvas/          원본 크기 렌더러 + 축소 미리보기 + 편집 레이어
│   ├── Sidebar/         디자인 패널의 각 카드
│   └── ui/              Chip · Toggle · Segmented · ColorField …
└── styles/
    ├── montage.css      Montage(WDS) 토큰 — 업스트림 거울, 손대지 않는다
    ├── brand.css        브랜드 교체 레이어 — primary ramp 만 재정의
    └── globals.css      앱 별칭(--color-*) 매핑 · 리셋 · 스크롤바
```

### 고치기 전에 알아 둘 것

- `BannerRenderer` 는 **항상 배너 원본 픽셀 크기로** 렌더한다. 축소는 `BannerPreview` 가
  CSS transform 으로만 처리하고, Export 는 프리뷰 DOM 을 캡처하지 않고 화면 밖에서
  렌더러를 다시 그려 캡처한다
- 색은 반드시 `resolveTheme(themeId, overrides)` 를 거친다. 테마 값을 직접 참조하면
  사용자가 지정한 색이 무시된다
- 슬롯 좌표는 `resolveSlotBox(layout, moduleId, …)` 로만 만든다. 레이아웃에 x/transform 을
  하드코딩하면 배치·정렬 설정이 무시된다
- `@font-face` 의 `format()` 은 Export 의 `preferredFontFormat` 과 **정확히 같아야 한다.**
  다르면 `html-to-image` 가 src 선언을 통째로 지워 결과물이 조용히 폴백 폰트로 렌더된다
- 회색 면·토글·업로드 박스는 Montage 대신 원본 빌더 값을 쓴다 (`--legacy-*`).
  의도한 예외이니 "DS 를 안 따랐다"고 되돌리지 말 것

## 기술 스택

React 18 · Vite · `html-to-image`(Export) · `jszip`(일괄 다운로드).
상태는 `useState` 만 쓰고, 스타일은 인라인 스타일 + CSS 변수입니다.

## 폰트

Pretendard Variable 을 번들에 동봉합니다 (SIL Open Font License 1.1).
배너 좌표가 이 폰트 메트릭 기준이라, CDN 장애로 폴백되면 결과물이 달라집니다.
