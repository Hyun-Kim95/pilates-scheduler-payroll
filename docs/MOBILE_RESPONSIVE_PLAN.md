# 모바일 반응형 작업 계획

모바일에서 레이아웃이 깨지지 않도록 수정하기 위한 작업 순서입니다.

---

## 1. 기본 설정 점검

- [ ] **viewport 및 메타 태그**  
  `frontend/index.html`에 `width=device-width, initial-scale=1.0` 이미 있음. 유지하고, 필요 시 `user-scalable`, `maximum-scale` 등 추가 검토.
- [ ] **전역 박스 모델**  
  `index.css`의 `box-sizing: border-box` 유지.
- [ ] **브레이크포인트 정의**  
  현재 768px만 사용 중. 필요 시 `640px`, `480px` 등 추가하여 `index.css` 또는 공통 변수로 정의.

---

## 2. 레이아웃·네비게이션 (Layout, Sidebar, Header)

- [ ] **사이드바 모바일 전환**  
  `Layout.css`: 768px 이하에서 현재는 너비만 64px로 축소됨.  
  → **선택 A**: 64px 아이콘 전용 사이드바로 유지하고, 네비 텍스트는 툴팁/aria-label로만 표시.  
  → **선택 B**: 768px 이하에서 사이드바를 숨기고, 헤더에 햄버거 버튼으로 드로어(슬라이드 인) 형태로 전환.  
  순서: 먼저 Sidebar에 아이콘 추가 가능 여부 확인 후, B 적용 시 Layout/Layout.css/Header/Sidebar 수정.
- [ ] **헤더 모바일**  
  `Layout.css` / `Header.jsx`:  
  - 헤더 타이틀(`필라테스 스케줄 · 정산`)이 좁은 화면에서 줄바꿈 또는 `font-size` 축소되도록 처리.  
  - 헤더 우측(테마 토글, 사용자 메뉴)이 줄지 않고 터치하기 좋은 크기 유지.  
  - 필요 시 헤더 패딩을 `1rem` 등으로 줄여서 공간 확보.
- [ ] **메인 콘텐츠 영역**  
  `Layout.css`의 `.page-content`: 모바일에서 `padding: 1rem` 등으로 축소해 가로 공간 확보.

---

## 3. 테이블 공통 대응 (index.css)

- [ ] **테이블 래퍼**  
  `.data-table`, `.payroll-table`, `.reservations-table` 등을 감싸는 공통 래퍼에  
  `overflow-x: auto`, `-webkit-overflow-scrolling: touch`, `min-width: 0` 적용해 가로 스크롤 가능하게 처리.  
  (이미 일부 페이지에서 wrapper 사용 중이면, 해당 wrapper에 동일 규칙 적용.)
- [ ] **테이블 최소 너비**  
  모바일에서 테이블이 너무 눌리지 않도록, 테이블에 `min-width`(예: 600px)를 주고 래퍼로 스크롤하게 할지,  
  또는 768px 이하에서만 카드형 리스트로 전환할지 결정 후 적용.
- [ ] **예약 목록 액션 열**  
  `index.css`의 `.reservations-table .th-actions { width: 220px; min-width: 220px }` 는 좁은 화면에서 테이블 가로 폭을 키움.  
  → 래퍼 스크롤로 처리하거나, 모바일에서만 액션을 행 안의 세로 배치/드롭다운으로 변경.

---

## 4. 페이지 헤더·툴바·폼 (공통)

- [ ] **page-header**  
  이미 768px에서 `flex-direction: column`, `align-items: flex-start` 적용됨.  
  모바일에서 버튼이 한 줄에 안 들어가면 `page-header-actions`를 줄바꿈/세로 쌓기 유지.
- [ ] **page-toolbar / reservations-toolbar**  
  날짜, 필터, 버튼이 많으므로 768px 이하에서 `flex-wrap`, `gap` 유지하고,  
  필요 시 `toolbar-group`을 세로로 쌓거나 일부를 접기(필터 접기) 처리.
- [ ] **form-input / form-date / form-select**  
  `min-width`가 있는 입력/셀렉트는 모바일에서 `min-width: 0` 또는 `width: 100%`로 덮어써서  
  한 줄이 넘치지 않게 처리.
- [ ] **버튼·터치 영역**  
  `.btn`, 헤더 버튼 등 최소 터치 영역 약 44px 높이 권장. 필요 시 패딩 조정.

---

## 5. 페이지별 수정

- [ ] **대시보드 (Dashboard)**  
  `dashboard-cards`는 `repeat(auto-fit, minmax(140px, 1fr))` 로 되어 있어 기본적으로 유동.  
  모바일에서 카드가 너무 작아지면 `minmax(120px, 1fr)` 또는 2열 고정 등 검토.  
  대시보드 테이블이 있으면 3번 테이블 래퍼 규칙 적용.
- [ ] **회원 관리 (Members)**  
  테이블이 있으면 3번 적용. 모달(회원 등록/수정)은 작은 화면에서 `max-width: 100%`, 여백 유지.
- [ ] **강사 관리 (Instructors)**  
  동일하게 테이블 래퍼 및 모달 반응형.
- [ ] **스케줄 (Schedule)**  
  `Schedule.css`:  
  - 주간 그리드는 이미 `min-width` + `overflow-x: auto` 로 가로 스크롤됨.  
  - 모바일에서 `.schedule-controls` 가 세로로 쌓이도록 768px 미디어쿼리 확인/보강.  
  - 월간 캘린더는 이미 768px에서 셀 높이·폰트 축소됨.  
  - 매우 좁은 화면(480px)에서 요일 헤더/셀 가독성 추가 조정 여부 검토.
- [ ] **예약 (Reservations)**  
  툴바 줄바꿈·필터 정리(4번) + 테이블 래퍼/액션 열 처리(3번).  
  테이블 대신 카드형 리스트로 전환할 경우 Reservations.jsx에서 조건부 렌더링 검토.
- [ ] **정산 (Payroll)**  
  `payroll-table` 에 3번 테이블 래퍼 적용. `payroll-toolbar` 는 4번 툴바 규칙 적용.
- [ ] **통계 (Statistics)**  
  차트/카드가 가로로 길면 `chart-wrap`, `stats-overview-cards` 등에 `max-width: 100%`,  
  `overflow-x: auto` 또는 그리드 열 수 조정.
- [ ] **비밀번호 변경 (ChangePassword)**  
  폼이 단일 컬럼이면 패딩만 모바일에서 조정.
- [ ] **로그인 (Login)**  
  `Login.css`: 이미 `max-width: 360px`, 중앙 정렬.  
  작은 화면에서 카드 좌우 마진(예: `margin: 0 1rem`) 확인.

---

## 6. 모달·오버레이

- [ ] **공통 모달**  
  `schedule-modal` 등: `max-width: 420px` 유지하고,  
  작은 화면에서 `width: calc(100% - 2rem)`, `max-height: 90vh`, `overflow-y: auto` 로  
  화면 밖으로 나가지 않게 처리.
- [ ] **모달 백드롭**  
  터치 기기에서 스크롤 잠금( body overflow ) 시 배경 스크롤 방지 여부 검토.

---

## 7. 기타·마무리

- [ ] **글자 크기·가독성**  
  모바일에서 본문/테이블 폰트가 지나치게 작아지지 않도록 `font-size` 하한 검토(예: 14px).
- [ ] **세로 모드 고정이 필요한 페이지**  
  스케줄 주간/월간 등은 가로가 넓을수록 유리하므로, 필요 시 해당 페이지만 `orientation` 힌트 또는 안내 문구 추가(선택).
- [ ] **실기기·에뮬레이터 테스트**  
  iOS Safari, Android Chrome 등에서 320px ~ 428px 폭으로 한 번씩 확인.

---

## 작업 순서 요약

| 순서 | 항목 | 파일(대상) |
|------|------|------------|
| 1 | 기본 설정·브레이크포인트 | index.html, index.css |
| 2 | 레이아웃·사이드바·헤더 | Layout.css, Layout.jsx, Sidebar.jsx, Header.jsx |
| 3 | 테이블 공통 (래퍼 + 스크롤/카드) | index.css, 각 페이지 wrapper |
| 4 | 페이지 헤더·툴바·폼 공통 | index.css |
| 5 | 페이지별 (대시보드, 회원, 강사, 스케줄, 예약, 정산, 통계, 비밀번호, 로그인) | 해당 페이지 jsx/css |
| 6 | 모달·오버레이 | Schedule.css, 공통 모달 스타일 |
| 7 | 폰트·테스트·마무리 | index.css, 실기기 테스트 |

이 순서대로 진행하면 레이아웃 뼈대(2) → 콘텐츠 컨테이너(3, 4) → 페이지별(5) → 예외 요소(6, 7) 순으로 안정적으로 모바일 대응할 수 있습니다.
