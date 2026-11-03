# 모듈러 배너 빌더 — Montage 스킨 (Modular Banner Builder)

> `banner-generator` 를 복제해 **UI 전체를 Montage(Wanted Design System, `@wanteddev/wds`)
> 규격으로 다시 입힌 버전**이다. 기능·상태·렌더 로직은 원본과 같고 바뀐 것은 화면뿐이다.
> 원본은 5173, 이 복제본은 5174 에서 돈다 (`vite.config.js`). 둘을 나란히 띄워 비교한다.
> Montage 적용 규칙은 아래 "Montage 디자인 시스템" 절에 정리되어 있다.

## 프로젝트 개요
이커머스 마케팅 디자이너를 위한 **프로모션 배너 자동 생성 어드민 툴**.
마케터가 프로모션 정보를 입력하면, 사전 정의된 레이아웃 템플릿 + 모듈 조합 + 컬러 테마로
채널별 배너를 자동 생성하는 시스템.

## 화면 구성: 빌더 허브 + 빌더

첫 진입은 편집기가 아니라 **빌더를 고르는 목록**(`components/Home/HomePage.jsx`)이다.
운영 지면이 늘어날 것을 전제로 한 구조라, 목록은 `constants/builders.js` 의
`BUILDER_GROUPS` 하나만 보고 그려진다.

**빌더를 추가하는 법 — 두 줄이면 끝난다**
1. `constants/builders.js` 의 그룹에 항목 추가 (`route` 지정, 아직이면 `status: "planned"`)
2. `App.jsx` 의 `ROUTES` 에 `route → 컴포넌트` 연결

`HomePage` 는 어떤 빌더가 있는지 모르고, 빌더가 늘어도 손대지 않는다.

라우팅은 해시(`#/banner`)다. 정적 호스팅(아티팩트·Vercel)에서 서버 설정 없이
뒤로가기·새로고침·딥링크가 그대로 동작하기 때문이고, 화면이 두 종류인 지금 단계에
라우터 라이브러리는 과하다. 등록되지 않은 해시는 홈으로 떨어진다.
빌더 화면의 컬리 워드마크가 목록으로 돌아가는 자리다.

## 화면 틀 — 좌: 작업 영역 / 우: 디자인 패널

Figma 처럼 **컨트롤 패널이 오른쪽**이다 (`BannerBuilder` 의 `<main>` → `<aside>` 순서).
왼쪽은 툴바 · 미리보기 · 생성 히스토리가 쓰는 작업 영역이다.

UI 프리미티브
- `ui/Segmented` — 회색 트랙 위 흰 알약. 지면 전환 등 2~3지 선택에 쓴다
- `ui/SidebarSection` — 접기 화살표 + `FieldLabel` · `SectionAction` 을 함께 export
- `ui/ColorField` — 한 줄 색 지정 `[라벨][■ #HEX][↺]`

색 토큰 (globals.css) — 값은 전부 `styles/montage.css` 의 Montage semantic 토큰을 가리킨다
- `--color-primary` = `--semantic-primary-normal` (**컬리 퍼플 #5F0080**) 채움 · 테두리 · 토글
- `--color-primary-light` = `--brand-purple-95` 선택 바탕 / `--color-primary-line` 선택 테두리
- `--color-primary-text` = `--semantic-primary-normal` — 흰 바탕 대비 11.7:1 이라 글자도 같은 색
- `--color-fill` / `--color-fill-strong` 입력칸 · 세그먼트 트랙 (테두리 없이 면으로 구분)

**색은 역할 드롭다운이 아니라 쓰는 자리에 둔다.**
- 배경색 → "배경" 카드 맨 위 (ColorField, 투명 토글 포함)
- 타이틀 · 서브 · 강조 · 태그 · CTA 색 → "콘텐츠 입력" 카드 아래
- 템플릿에 **슬롯이 있는 역할만** 보여 준다 (BannerBuilder 의 `textColorRoles`).
  태그 색 2종은 태그 표현이 "뱃지" 일 때만 나온다.
- `ColorSection`(역할 드롭다운)은 사이드바에서 뺐지만 파일은 남겨 뒀다.

이 틀은 올리브영 빌더(v2)에서 가져왔다. 가져올 때 **배너 출력에 관여하는 것은 제외**했다 —
`BannerRenderer` · `SlotRenderer` · `BannerPreview` · `PreviewIndicator` 와
`constants` 의 데이터(LAYOUTS · SIZES · THEMES)는 컬리 값 그대로다.
v2 의 `getTypeScale`(권장 규격 대비 타이포 비례 축소) 등은 Figma 실측 좌표를 바꾸므로 가져오지 않았다.
같은 이유로 "텍스트" 카드의 **Format(굵게·기울임·취소선)** 도 뺐다 — v2 렌더러가 그리는 기능이라
가져오면 눌러도 아무 일 없는 컨트롤이 된다. 폰트 두께는 v1 의 전역 프리셋(가볍게/기본/굵게)을
`Segmented` 로만 다시 그렸다.

## 핵심 아키텍처: 레이어 분리 구조
이 시스템의 핵심 설계 원칙은 배너를 독립 레이어로 분리하는 것:

1. **Layout (수직 구성 + 프레임)** — 텍스트 모듈의 y 좌표, 블록 폭, 프레임 형태를 정의.
   **웹 / 앱 채널로 분류**한다 (`channel` 필드, 사이즈 프리셋도 동일).

   웹 5종
   - 와이드 에디토리얼: 텍스트 세로 중앙 · 좌측 정렬 (컬리 PC 풀배너 형태)
   - 센터 페스타: 중앙 정렬, 세일/이벤트용
   - 상단 헤드라인: 텍스트 상단 · 하단 여백 확보
   - 하단 캡션: 사진 강조 · 텍스트 하단
   - 임팩트 세일: 할인율 강조 · 중앙 정렬

   앱 3종 (실물 지면 기준)
   - ① 앱 모달 팝업 (1080×1240): 세로형 · 전체 라운드 · 하단 풀와이드 CTA 바
   - ② 앱 홈 메인 배너 (1125×840): 캐러셀 · 좌측 텍스트 · 우하단 인디케이터
   - ③ 앱 하단 시트 팝업 (1125×880): 상단만 라운드 · 인라인 CTA

   캐러셀 인디케이터(알약 322×84 + 재생 원 84×84)는 Figma 좌표를 비율로 환산한
   `INDICATOR_SPEC` 을 따르며 **미리보기에만** 그린다.

   앱 템플릿을 고르면 **권장 규격이 자동 적용**된다 (`recommendedSize`).
   레이아웃은 **이미지 위치를 정의하지 않는다.** 이미지는 어떤 레이아웃에서든
   배경으로 합성된다 (v0.3 에서 imageArea 슬롯 제거 — `docs/slot-system.md`).
   장식 레이어(원형 등)는 v0.4 에서 제거했다 — 배경은 이미지와 그라데이션만 그린다.

   표준은 **앱 홈 메인 배너(1125×840) Figma 원본**이다 — 타이틀 86px Regular/Medium
   자간 -5%, 서브카피 42px 자간 +3%, 기간 38px. 슬롯 y 는 Figma 의 잉크 좌표를
   라인박스 좌표로 역산해 넣는다(`docs/slot-system.md` 변환식).
   템플릿은 `recommendedSize` 기준으로 잡혀 있고, 비율이 많이 다른 규격을 고르면
   사이드바가 그 사실을 알려 준다(사이즈 칩의 "권장" 표시 + 안내문).

2. **배치 / 정렬 (사용자 설정)** — 레이아웃과 독립적으로, Figma Design 패널 방식:
   - 정렬: 좌 / 가로중앙 / 우 + 상 / 세로중앙 / 하 아이콘 6개. Figma 처럼
     "모드"가 아니라 **누르면 옮기는 동작**이고, 현재 위치는 X / Y 가 알려 준다
   - 위치: X / Y 를 배너 좌표(px)로 직접 입력 (↑↓, Shift+↑↓ 10px)
   - 글줄 정렬: 박스 안에서의 글줄 맞춤 — 박스를 옮기는 정렬과 별개다
   - 대상은 위치 편집에서 고른 슬롯 하나, 안 골랐으면 텍스트 블록 전체
   - "블록 중앙 + 글줄 좌측"이 컬리 풀배너의 기본 조합이다

   좌표는 계산이 아니라 미리보기 DOM 실측이다 (`lib/slotGeometry.js`).
   그래서 슬롯에는 위치 트랜지션을 두지 않는다 — 애니메이션 중 측정값이
   보간되어 정렬이 어긋난다. 자세한 내용은 docs/slot-system.md 참고.
   - 폰트 두께: 가볍게 / 기본 / 굵게 (컬리 톤은 얇은~중간 두께가 기본)

3. **Module (콘텐츠)** — 각 슬롯에 들어가는 블록 단위 요소:
   - eventTag: 이벤트 태그 — 뱃지 또는 타이틀 위 잔글씨(기본)
   - title: 메인 타이틀 — **두 줄 구성**. `titleLead`(윗줄)는 타이틀과 **같은 크기**이고
     두께만 가볍다(Regular), 아랫줄이 Bold. 레퍼런스의
     "컬리와 함께하는(Regular) / 9월의 결제 혜택(Bold)" 구성이 이것이다.
   - subtitle: 서브 카피 (혜택 설명)
   - discount: 할인 뱃지 (최대 50% 할인)
   - date: 기간 표시
   - cta: CTA — 레이아웃에 따라 하단 풀와이드 바 또는 인라인 버튼 (앱 전용)

   레이아웃이 지원하지 않는 모듈은 모듈 토글에서 "미지원"으로 표시된다.
   **캐러셀 인디케이터는 모듈이 아니다.** 지면 UI 라 배너 이미지에 포함되면 안 되므로
   미리보기 전용 오버레이로 분리했다 (캔버스 툴바의 "인디케이터 표시" 토글).
   토글은 **앱 홈 메인 배너 템플릿 + 앱 홈 메인 규격(1125×840)** 일 때만 나온다.
   규격이 다르면 인디케이터 좌표가 실제 지면과 어긋나기 때문이다.

   또 앱 규격은 형태가 곧 스펙이라, 규격을 고르면 짝이 되는 템플릿까지 함께
   적용한다 (docs/slot-system.md "규격 ↔ 템플릿 짝").

4. **Theme (무드)** — 브랜드 기본값 1종(퍼플 브랜드)만 둔다.
   역할별 지정이 가능해진 뒤로 프리셋을 여럿 둘 이유가 없어졌다.
   - 8개 역할(배경/타이틀/서브/강조/태그배경/태그글자/CTA배경/CTA글자)을
     HEX·RGB·스포이드로 직접 덮어쓸 수 있다 (`resolveTheme()`)
   - UI 는 역할을 한 번에 늘어놓지 않고 **하나씩** 고른다 (`ColorSection`)
     — [색 점][# HEX][기본값] 행 + 인라인 피커(채도·명도 사각형 + 색상 슬라이더)
   - 배경은 "배경 없음"(투명)도 선택 가능 → PNG 로 뽑으면 투명 배너
   - 배경 이미지가 있으면 사진 위 리니어 그라데이션을 별도 설정 (`lib/gradient.js`)

## 레퍼런스 배너 분석 (컬리 기반)
`/docs/banner-analysis.md` 에 업로드된 컬리 배너 9종의 패턴 분석 결과 정리됨.
레이아웃 템플릿은 이 분석에서 도출된 것.

## 기술 스택
- React 18 + Vite
- 스타일: 인라인 스타일 + CSS 변수 (montage.css 토큰 → globals.css 별칭)
- 상태관리: React useState (규모 커지면 Zustand 고려)
- 이미지 Export: `html-to-image` (dom-to-image 계열 유지보수판)
- ZIP: `jszip`
- 배포: Vercel, 또는 **Claude 아티팩트** (서버 없이 영구 URL — 아래 참고)

## 현재 구현 상태 (v0.4)
- [x] 배너 사이즈 프리셋 8종 — 웹 3 / 앱 5 (채널별 분류)
- [x] 레이아웃 템플릿 8종 — 웹 5 / 앱 3 + 배치 3 × 정렬 3 조합
- [x] 지면(웹/앱) 전환 — 사이즈·템플릿 목록이 선택한 지면만 노출
- [x] 앱 지면 프레임 요소 (라운드 코너 · CTA 바/버튼 · 캐러셀 인디케이터)
- [x] 폰트 두께 3단 (titleLead 는 항상 타이틀보다 가볍게) · 태그 뱃지/텍스트 전환
- [x] 브랜드 테마 1종 + 역할별 색상 직접 지정 8개 (HEX / RGB / 스포이드 / 배경 없음)
- [x] 배경 그라데이션 (방향 · 시작·끝 색 · 불투명도 · 전환 지점)
- [x] 콘텐츠 입력 (타이틀, 서브카피, 할인, 기간, 이벤트태그)
- [x] 모듈 ON/OFF 토글
- [x] 텍스트 길이 기반 자동 폰트 사이징
- [x] 생성 히스토리 패널 (썸네일 · 재다운로드 · 설정 복원)
- [x] 프리뷰 = 결과물 일치 렌더 구조 (원본 크기 렌더 + transform 축소)
- [x] 빌더 허브 — 첫 진입에서 운영 지면별 빌더를 고른다 (레지스트리 기반, 해시 라우팅)

## 다음 구현 우선순위 (v0.4 ~ v1.0)

### Phase 1: 핵심 기능 완성 ✅ 완료
- [x] **이미지 업로드 + 배경 제거**: 드래그&드롭 업로드 → 누끼 → 배경으로 자동 합성
      (프로바이더 교체형: 영역 지정 누끼 / remove.bg / 사내 서버 / 브라우저 AI)
      · 남길 영역을 사각형으로 직접 지정 → 밖은 제거, 안쪽 단색 배경도 함께 제거
      · 누끼 결과는 원본과 별도 보관 → 표시 토글 / "누끼 취소"로 원본 복귀
- [x] **이미지 자유 변형**: 포토샵 스타일 8핸들(코너4+엣지4) · 본체 드래그 이동 ·
      휠 확대/축소 · 비율 뱃지 1.2초 표시. 상태는 `{ scale, x, y }` (scale 1 = cover)
      · 이미지는 레이아웃과 무관하게 항상 배경으로 합성된다
- [x] **배경 확장(생성형 확장)**: 방향·확장량 지정 → 엣지/미러 합성 또는 사내 AI 서버
- [x] **내용 인식 비율**: 심 카빙으로 피사체 보존하며 배너 비율에 맞춤
- [x] **실제 이미지 Export**: `html-to-image` 로 PNG/JPG · 1x/2x/3x 배율 다운로드
- [x] **배치 Export**: 현재 레이아웃 채널의 사이즈 일괄 생성 → manifest.json 포함 ZIP
- [x] **드래그 앤 드롭**: 캔버스에서 모듈 위치 미세 조정 (포인터 이벤트 직접 구현,
      % 오프셋 저장 · 중앙/원위치 스냅 · 방향키 조정)

> 설계 근거와 함정(폰트 임베드 캐시, 백그라운드 탭 rAF 정지, 누끼 라이선스 등)은
> `docs/export-pipeline.md` 에 정리되어 있다. Phase 1 코드를 수정하기 전에 읽을 것.

### Phase 2: 데이터 연동
- [ ] **Google Sheets / Notion 연동**: 프로모션 데이터 자동 읽기
- [ ] **Figma API Export**: 생성 결과를 Figma 프레임으로 직접 Push
- [ ] **에셋 관리 대시보드**: 생성된 배너의 채널별/프로모션별 관리

### Phase 3: AI 강화
- [ ] **AI 카피 생성**: 프로모션 유형 입력 시 타이틀/서브카피 자동 제안
- [ ] **AI 레이아웃 추천**: 콘텐츠 길이와 유형에 따라 최적 레이아웃 자동 추천
- [ ] **성과 데이터 기반 개선 제안**: A/B 테스트 결과 학습하여 비주얼 개선 포인트 도출

## 파일 구조
```
banner-generator/
├── CLAUDE.md              ← 이 파일 (Claude Code 컨텍스트)
├── .env.example           ← 누끼·아웃페인팅 프로바이더 환경변수 샘플
├── package.json
├── vite.config.js
├── index.html
├── public/
├── docs/
│   ├── banner-analysis.md  ← 컬리 배너 패턴 분석
│   ├── slot-system.md      ← 슬롯 시스템 설계 문서
│   └── export-pipeline.md  ← Export/누끼/이미지 편집 설계 + 함정 정리
└── src/
    ├── main.jsx
    ├── App.jsx            ← 해시 라우터 (홈 ↔ 빌더)
    ├── BannerBuilder.jsx  ← 배너 편집 화면 (어드민 레이아웃 + 상태 오케스트레이션)
    ├── assets/
    │   ├── favicon.svg    ← 컬리 마크 (퍼플 타일 + 흰 워드마크)
    │   └── fonts/         ← Pretendard Variable (번들 동봉)
    ├── constants/
    │   ├── builders.js    ← 빌더 레지스트리 — 홈 목록의 유일한 원본
    │   ├── sizes.js       ← 배너 사이즈 프리셋 (웹/앱 채널)
    │   ├── layouts.js     ← 레이아웃 템플릿 + 슬롯/프레임 정의
    │   └── themes.js      ← 컬러 테마 팔레트
    ├── lib/
    │   ├── exportImage.js      ← 화면 밖 렌더 + 캡처 + 배치 ZIP
    │   ├── removeBackground.js ← 누끼 프로바이더 (region/removebg/endpoint/imgly)
    │   ├── imageTransform.js   ← 배경 이미지 변형 모델(scale/x/y) + 8핸들 계산
    │   ├── imageExpand.js      ← 배경 확장(엣지·미러·AI 아웃페인팅)
    │   ├── seamCarve.js        ← 내용 인식 비율 (심 카빙)
    │   ├── gradient.js         ← 배경 리니어 그라데이션 설정/CSS 생성
    │   ├── imageUtils.js       ← 이미지 로드·리사이즈·트리밍·썸네일
    │   ├── color.js            ← HEX/RGB 변환 + 스포이드(EyeDropper)
    │   └── download.js         ← 파일명 정리 + 브라우저 다운로드
    ├── components/
    │   ├── Home/
    │   │   ├── HomePage.jsx      ← 첫 진입 — 빌더 선택 허브
    │   │   └── BuilderIcon.jsx   ← 목록용 선 아이콘 세트
    │   ├── Sidebar/
    │   │   ├── SizeSelector.jsx
    │   │   ├── LayoutPicker.jsx
    │   │   ├── ChannelSwitch.jsx    ← 웹 / 앱 지면 전환
    │   │   ├── ColorSection.jsx     ← 역할 하나씩 색 지정 (+ 배경 없음)
    │   │   ├── TextStyleControls.jsx ← 정렬 / X·Y 위치 / 글줄 정렬 / 두께 / 태그
    │   │   ├── GradientEditor.jsx   ← 배경 그라데이션 (배경 이미지 있을 때)
    │   │   ├── ContentEditor.jsx
    │   │   ├── ImageUploader.jsx    ← 배경 이미지 업로드 + 누끼
    │   │   ├── ImageAdjustPanel.jsx ← 위치·크기 수치 조정 + 배경 확장 + 비율 보정
    │   │   └── ModuleToggles.jsx
    │   ├── Image/
    │   │   └── RegionSelector.jsx   ← "남길 영역" 사각형 지정 모달
    │   ├── Canvas/
    │   │   ├── BannerRenderer.jsx   ← 원본 크기 순수 렌더러 (프리뷰/Export 공용)
    │   │   ├── BannerPreview.jsx    ← 배율 축소 표시 + 편집 가이드
    │   │   ├── SlotBox.jsx          ← 슬롯 위치 + 드래그/방향키 조정
    │   │   ├── ImageTransformEditor.jsx ← 8핸들 자유 변형 조작 레이어
    │   │   ├── SlotRenderer.jsx     ← 각 모듈의 시각적 표현
    │   │   └── CanvasToolbar.jsx    ← 편집 모드 / 포맷 / 배율
    │   ├── History/
    │   │   └── GenerationHistory.jsx
    │   └── ui/
    │       ├── Chip.jsx
    │       ├── Toggle.jsx
    │       ├── ColorPickerPanel.jsx ← 인라인 컬러 피커 (채도·명도 + 색상 슬라이더)
    │       ├── ColorRow.jsx         ← [점][HEX][기본값] 컴팩트 색 편집 행
    │       ├── KurlyLogo.jsx        ← 컬리 워드마크 (currentColor)
    │       └── SidebarSection.jsx
    └── styles/
        ├── montage.css    ← Montage(WDS) 토큰 레이어 + .ty-* 타이포 유틸 (WDS 거울, 손대지 않음)
        ├── brand.css      ← 브랜드 교체 레이어 — primary ramp 만 컬리 퍼플로 덮는다
        └── globals.css    ← 앱 별칭(--color-*) 매핑 · 리셋 · 포커스 · 스크롤바
```

## Montage 디자인 시스템 (이 복제본의 UI 규칙)

원본: `C:\Users\user\Desktop\Montage\montage-web-main` (`@wanteddev/wds@3.11.0`).
`ds-bundle/_ds_bundle.css` 의 토큰과 `packages/wds/src/components/*/style.ts` 의
실제 컴포넌트 수치를 읽어 옮겼다. **값을 새로 지어내지 않는다** — 필요한 수치가
없으면 DS 소스에서 찾아 `montage.css` 에 토큰으로 추가하고 쓴다.

**타이포** — `.ty-*` 클래스 하나가 size/line-height/letter-spacing 셋을 가져간다
(DS `<Typography variant>` 와 1:1). 인라인 스타일에 `fontSize: 12` 처럼 숫자를 박지 않는다.
- heading2 20 · headline1 18 · headline2 17 · body1 16 · body2 15
- label1 14 · label2 13 · caption1 12 · caption2 11
- weight 는 400 / 500 / 600 세 단계뿐이다 (`--font-weight-regular|medium|bold`).
  DS 에서 700 은 display·title 계열 전용이라 UI 글자에는 쓰지 않는다.

**간격** — `--spacing-*` 스케일(2·4·6·8·10·12·14·16·20·24·32·40·48·56·64·72·80).
여기 없는 값(18, 22, 9 …)은 쓰지 않는다. 패널 안쪽 가로 여백은 `--panel-gutter`(20) 하나로 통일.

**라운드** — DS 컴포넌트가 실제로 쓰는 값만 둔다.
`--radius-checkbox` 5 · `--radius-xs` 6(Chip xs) · `--radius-sm` 8(Button·Chip sm)
· `--radius-md` 10(Button md) · `--radius-lg` 12(TextField·Select·Card) · `--radius-xl` 16(화면 틀 카드)
· `--radius-full`(Switch·PushBadge·진행 막대)

**컨트롤 높이** — DS 3단을 그대로: `--control-height-sm|md|lg` = 32 / 40 / 48.
- 텍스트 입력 · 드롭다운 · 색 입력 → `--radius-lg`(12) + md(40)
- **패널 폭을 꽉 채우는 동작 버튼 → md(40) + `--radius-md`(10).** 같은 칸의 입력·세그먼트가
  40 인데 버튼만 32 면 줄이 어긋나 보인다.
- 툴바처럼 좁은 자리에 여럿 늘어놓는 버튼 → sm(32) + `--radius-sm`(8)

**상태 색** — 투명도로 흐리지 않는다. 비활성은 `--color-disable-bg` + `--color-text-disable`,
알림은 `--color-{danger,warning,success}-bg` 와 `-text` 짝을 쓴다 (DS SectionMessage 톤).

**화면 틀** — 회색 면(`--color-surface`) 위에 라운드 16 카드를 띄우고 카드 사이를 16 으로 벌린다
(`BannerBuilder` 의 `canvasCard` · 디자인 패널 · 생성 히스토리).

**세그먼트는 `ui/Segmented` 하나만 쓴다.** 같은 모양을 두 벌 유지하면 한쪽만 DS 를 따라간다
(툴바용은 `inline` prop 으로 폭을 글자 길이에 맞춘다).

**스크롤 영역에는 `data-autohide-scroll` 을 붙인다.** 스크롤바가 스크롤하는 동안에만
보이고 1.2초 뒤 사라진다 (`lib/autoHideScrollbar.js` 가 `data-scrolling` 을 달고 떼면,
globals.css 의 `::-webkit-scrollbar-thumb` 가 색만 바꾼다). scroll 이벤트는 버블링하지
않아 document 에 capture 로 한 번만 달아 두었으니, 새 스크롤 패널에는 속성만 붙이면 된다.
**폭(8px)은 늘 차지하고 색만 바뀐다** — 폭까지 접으면 스크롤바가 나타날 때마다 내용이
8px 씩 밀려 글이 흔들린다.

**브랜드 색은 `brand.css` 한 곳에서만 바꾼다.** Montage 의 원티드 블루 대신 컬리 퍼플
`#5F0080` 을 쓴다. 바꾸는 방법은 토큰 이름을 갈아 끼우는 게 아니라 **primary ramp 의 값만
다시 정의하는 것**이다 — `--semantic-primary-normal|strong|heavy`, `-rgb`,
`--semantic-line-primary-normal|strong`. 그래서 컴포넌트 코드는 한 줄도 바뀌지 않는다.
ramp 는 WDS blue 와 같은 관계로 만들었다 (strong = L×0.92, heavy = L×0.82, 95 = 옅은 틴트).

**원본 빌더(5173)에서 그대로 가져온 자리들** — Montage 규격보다 원본 쪽이 나아서 일부러
되돌린 것이니 "DS 를 안 따른 실수"로 보고 고치지 말 것. 값은 globals.css 의 `--legacy-*`
토큰으로 이름을 달아 뒀고, 여기 있는 것 말고 새 회색을 즉흥적으로 만들지 않는다.

- **회색 면 전부** (`--legacy-gray-surface` #F7F7F9) — 페이지 면 · 입력칸 · 세그먼트 트랙 ·
  토글 꺼진 트랙 · 생성 히스토리 박스. Montage 의 `fill`(#70737C14)은 알파를 얹는
  쿨그레이라 흰 바탕에서 ≈#F4F4F5 로 떨어진다. 회색 박스가 많은 화면이라 그 세 톤 차이가
  "탁하다"로 읽혔다. **패널 안의 회색 면은 전부 이 한 톤이다** — 토글만 진한 회색을
  쓰던 것도 여기에 맞췄다.
- 히스토리 태그 배경 (`--legacy-gray-tag` #F1F1F4)
- `ui/Toggle` — 36×20 트랙 · 16px 썸 (DS Switch sm 44×26 아님). 켜진 색만 포인트 컬러.
  꺼진 트랙이 카드 면과 거의 같은 밝기라 **썸의 그림자가 유일한 윤곽이다** — 지우지 말 것
- `ImageUploader` 의 업로드 박스 — `--legacy-upload-bg` #FAFAFB + 2px dashed + 라운드 10

카드 면(흰색) · 선 · 그림자 · 상태색은 Montage 그대로다. 되돌린 건 회색 면뿐이다.

### 렌더 계층 규칙 (중요)
- `BannerRenderer` 는 **항상 배너 원본 픽셀 크기로** 렌더한다. 이 안에서 프리뷰 배율을
  곱하면 안 된다 — 축소는 `BannerPreview` 가 CSS transform 으로만 처리한다.
- Export 는 프리뷰 DOM 을 캡처하지 않고, 화면 밖에서 `BannerRenderer` 를 다시 렌더해
  캡처한다. 따라서 새 모듈/장식을 추가할 때 `BannerRenderer` 안에 넣으면 Export 에도
  자동 반영된다.
- 편집 전용 UI 요소에는 `data-export-ignore` 를 붙인다.
- 색은 반드시 `resolveTheme(themeId, overrides)` 를 거친다. 테마 값을 직접 참조하면
  사용자가 지정한 색이 무시된다.
- 배경색은 `transparent` 일 수 있다. `${theme.bg}ee` 처럼 HEX 알파를 문자열로 붙이는
  코드를 새로 쓰지 말 것 — `lib/color.js` 의 `withAlpha()` / `isTransparent()` 를 쓴다.
- 그라데이션 CSS 는 `resolveGradient(gradient, theme)` 한 곳에서만 만든다.
- 슬롯 좌표는 `resolveSlotBox(layout, moduleId, { position, align })` 로만 만든다.
  레이아웃에 x/transform 을 하드코딩하면 배치·정렬 설정이 무시된다.
- 텍스트 크기는 `min(높이, 너비 × 0.55)` 기준값에서 파생한다. 높이만 쓰면
  PC 풀배너(1920×360)에서 글자가 과도하게 작아진다.
- UI/배너 텍스트에 굵은 헤비 웨이트를 기본값으로 쓰지 않는다 (컬리 톤).
- UI 텍스트에 이모지를 쓰지 않는다. 레이아웃 썸네일의 도형 기호(▤ ◆ ◰ ◱ ◈ ▣ ◧ ◲)는 예외.
- 배너 배경에 장식 도형을 넣지 않는다. 배경은 색·이미지·그라데이션으로만 만든다.
- 블록 정렬과 무관한 프레임 요소(CTA 바)는 슬롯이 아니라 `BannerRenderer` 의
  프레임 레이어에서 그린다. 라운드 코너는 `getFrameRadius()`.
- 지면 UI(캐러셀 인디케이터 등)를 배너에 굽지 않는다. 미리보기 전용 오버레이로 만들고
  `data-export-ignore` 를 붙이며, Export 경로에는 플래그를 넘기지 않는다.
- 슬롯 y 는 그 템플릿의 `recommendedSize` 에서 실측한 값으로 넣되, Figma 의 잉크 좌표를
  **라인박스 좌표로 변환**해야 한다. 폰트 크기·자간·행간은 `TYPE_RATIO` /
  `LETTER_SPACING` / `LINE_HEIGHT` 를 쓰고 컴포넌트에 직접 박지 않는다. 타이틀 블록과 서브카피 사이는 최소 27% 를 띄운다
  (납작한 규격에서 두 줄 타이틀이 서브카피와 겹치는 것을 막기 위해).
- 프리뷰 배율은 **배너가 놓이는 스테이지 박스만** 측정해 계산한다. 캡션·안내문이 든
  바깥 컨테이너를 재면 세로 여유를 과대평가해 세로로 긴 규격이 잘린다.
- 포인트 컬러는 `--color-primary`(Montage primary #0066FF)만 쓴다. 컴포넌트에 색을 직접 박지 말 것.
  단 **컬리 워드마크(#5F0080)와 배너 출력 색은 예외** — 브랜드/산출물이지 UI 가 아니다.
- 배경 이미지 좌표는 `computeImageLayout()` 하나로만 계산한다 (프리뷰·Export·편집 공용).
- 파괴적 이미지 편집(확장·비율 보정)은 `image.src` 만 교체하고 `image.baseSrc` 는
  건드리지 않는다. 되돌리기가 이 값에 의존한다.
- @font-face 의 `format()` 은 Export 의 `preferredFontFormat` 과 **정확히 같아야 한다**.
  다르면 html-to-image 가 src 선언을 통째로 지워 결과물이 조용히 폴백 폰트로 렌더된다
  (docs/export-pipeline.md "폰트 임베드 — 조용히 폴백되는 함정").
- PNG Export 에는 sRGB 청크를 붙인다(`lib/pngColorProfile.js`). 태그가 없으면 뷰어가
  모니터 프로파일로 해석해 브라우저에서 보던 색과 미세하게 달라진다. 픽셀은 손대지 않는다.
- Export 의 대기에는 반드시 상한을 둔다. 탭 가시성 대기까지 포함한 전체 상한이 없으면
  숨겨진 탭에서 promise 가 영구 pending 으로 남는다.
- 무거운 픽셀 연산은 버퍼를 재사용하고 진행률 갱신용으로만 이벤트 루프를 양보한다
  (심 카빙에서 할당 남발로 18초 → 0.7초 차이가 났다).

## 실행 방법
```bash
npm install
npm run dev   # http://localhost:5174 (원본 banner-generator 는 5173)
```

## 아티팩트 배포 (서버 없이 쓰기)

전 기능이 브라우저에서 도는 클라이언트 앱이라 정적 번들만 올리면 된다.

```bash
npm run build:artifact   # dist/artifact.html + dist/assets/*
```

`dist/artifact.html` 을 페이지로, `dist/assets/*` 를 함께 올린다
(published path 는 `assets/<파일명>`, `capabilities: { downloads: true }`).
같은 URL 로 갱신하려면 그 아티팩트 URL 을 `url` 로 넘긴다.

아티팩트 환경에 맞추느라 세 가지가 코드에 반영되어 있다 — 되돌리지 말 것.

1. `vite.config.js` 의 `base: './'` — 자산을 상대 경로로 참조해야 한다.
2. **Pretendard 를 번들에 동봉**한다 (`src/assets/fonts` + globals.css @font-face).
   아티팩트 CSP 는 외부 스타일시트를 Google Fonts 외에는 모두 막는다. 같은 출처라
   Export 의 폰트 임베드도 CORS 없이 돈다. 배너 좌표가 이 폰트 메트릭 기준이라
   CDN 폴백은 결과를 바꾼다.
3. `lib/download.js` 는 `claude.use("downloads")` 를 먼저 쓴다. 아티팩트 뷰어는
   페이지가 스스로 시작한 다운로드(`<a download>` · blob:/data: 포함)를 막는다.
   capability 가 없으면(로컬/Vercel) 기존 링크 방식으로 떨어진다.

아티팩트에서 **동작하지 않는 것**: remove.bg / 사내 서버 누끼(외부 fetch 차단),
브라우저 AI 누끼(런타임 모델 다운로드 차단). 기본값인 "영역 지정 누끼"와
배경 확장·내용 인식 비율은 전부 로컬 연산이라 그대로 동작한다.

누끼나 배경 확장을 AI 서버로 처리하려면 `.env.example` 를 `.env` 로 복사해 값을 채운다.
설정이 없어도 "영역 지정 누끼"와 "엣지/미러 배경 확장"이 로컬에서 기본 동작한다.

## 커맨드 컨벤션
- 컴포넌트: PascalCase
- 상수/config: camelCase
- CSS: CSS Modules (.module.css) 또는 인라인 스타일
- 커밋: conventional commits (feat:, fix:, refactor:)
