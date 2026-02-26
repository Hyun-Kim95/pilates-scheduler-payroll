# Pilates Scheduler & Payroll System

필라테스 센터 강사 스케줄 · 정산 관리 시스템 (웹 기반 내부용)

## 기술 스택

- **Frontend**: React (Vite), React Router, Axios
- **Backend**: Node.js, Express, JWT, bcrypt
- **DB**: MySQL / MariaDB

## 사전 요구사항

- Node.js 18+
- MySQL 8+ 또는 MariaDB

## 실행 방법

아래 순서대로 진행하면 됩니다.

### 1단계: DB 생성 및 테이블 만들기

MySQL이 실행 중인 상태에서 프로젝트 루트(`PilatesSystem`)에서:

```bash
mysql -u root -p < backend/db/schema.sql
```

비밀번호 없으면 `-p` 제외하고:

```bash
mysql -u root < backend/db/schema.sql
```

Windows CMD에서는:

```cmd
mysql -u root -p < backend\db\schema.sql
```

→ `pilates_scheduler` DB와 테이블(users, instructors, members 등)이 생성됩니다.

---

### 2단계: 전용 DB 계정 만들기 (권장)

애플리케이션 전용 계정 `pilates_app`을 쓰면 root를 쓰지 않아도 됩니다.

1. **`backend/db/create-user.sql`** 파일을 연다.
2. **`'여기에_원하는_비밀번호'`** 를 본인이 정할 비밀번호로 바꾼다.
3. MySQL **root**로 아래처럼 실행한다.

```bash
mysql -u root -p < backend/db/create-user.sql
```

(Windows: `mysql -u root -p < backend\db\create-user.sql`)

→ 이후 `.env`에서는 `DB_USER=pilates_app`, `DB_PASSWORD=방금_정한_비밀번호` 로 사용하면 됩니다.  
(root 계정을 그대로 쓰려면 이 단계를 건너뛰고, `.env`에 `DB_USER=root`와 root 비밀번호를 넣으면 됩니다.)

---

### 3단계: 백엔드 환경 설정 및 관리자 계정

```bash
cd backend
```

**환경 변수 파일 만들기**

- Windows: `copy .env.example .env`
- Mac/Linux: `cp .env.example .env`

**`.env` 파일 열어서 수정**

- 전용 계정을 만들었다면: `DB_USER=pilates_app`, `DB_PASSWORD=` 에 **create-user.sql에서 정한 비밀번호** 입력
- root를 쓴다면: `DB_USER=root`, `DB_PASSWORD=` 에 root 비밀번호 입력 (없으면 비워두기)
- 필요하면 `DB_HOST`, `DB_PORT`, `DB_NAME` 확인

**패키지 설치**

```bash
npm install
```

**관리자 계정 생성 (최초 1회)**

```bash
node scripts/seed-admin.js
```

→ `Admin user ready: admin@pilates.local / admin123` 메시지가 나오면 성공.

---

### 4단계: 백엔드 서버 실행

```bash
npm run dev
```

→ `Server running at http://localhost:4000` 이 보이면 백엔드 실행 중입니다.  
이 터미널은 **그대로 두고** 다음 단계로 갑니다.

---

### 5단계: 프론트엔드 실행 (새 터미널)

새 터미널을 열고:

```bash
cd frontend
npm install
npm run dev
```

→ `Local: http://localhost:5173` 이 보이면 프론트 실행 중입니다.

---

### 6단계: 브라우저에서 접속

1. 브라우저에서 **http://localhost:5173** 접속
2. 로그인 화면에서:
   - **이메일:** `admin@pilates.local`
   - **비밀번호:** `admin123`
3. 로그인 후 대시보드·강사 관리·회원 관리·스케줄·예약·정산 메뉴 사용

---

### 한 번에 정리

| 순서 | 작업 | 명령 |
|------|------|------|
| 1 | DB 스키마 적용 | `mysql -u root -p < backend/db/schema.sql` |
| 2 | 전용 계정 생성 (권장) | `create-user.sql`에서 비밀번호 수정 후 `mysql -u root -p < backend/db/create-user.sql` |
| 3 | backend로 이동 | `cd backend` |
| 4 | .env 생성 | `copy .env.example .env` (Windows) / `cp .env.example .env` (Mac/Linux) |
| 5 | .env에 DB 사용자·비밀번호 입력 | `DB_USER=pilates_app`, `DB_PASSWORD=비밀번호` (또는 root) |
| 6 | 백엔드 패키지 설치 | `npm install` |
| 7 | 관리자 계정 생성 | `node scripts/seed-admin.js` |
| 8 | 백엔드 실행 | `npm run dev` (터미널 1 유지) |
| 9 | 새 터미널에서 frontend로 이동 | `cd frontend` |
| 10 | 프론트 패키지 설치 | `npm install` |
| 11 | 프론트 실행 | `npm run dev` |
| 12 | 브라우저 접속 | http://localhost:5173 → 로그인 |

## 환경 변수

- **backend/.env**: `PORT`, `DB_*`, `JWT_SECRET`, `FRONTEND_URL`, (선택) `KAKAO_ALIMTALK_*`
- **frontend**: `VITE_API_URL` (기본값은 프록시로 `/api` 사용)

## API 개요

| 구분 | 경로 | 설명 |
|------|------|------|
| 인증 | POST /api/auth/login | 로그인 |
| 인증 | GET /api/auth/me | 현재 사용자 |
| 강사 | GET/POST /api/instructors | 목록/등록 |
| 강사 | GET/PATCH/DELETE /api/instructors/:id | 조회/수정/삭제 |
| 회원 | GET/POST /api/members | 목록/등록 |
| 회원 | GET/PATCH/DELETE /api/members/:id | 조회/수정/삭제 |
| 슬롯 | GET/POST /api/schedule-slots | 목록/등록 (from, to, instructor_id) |
| 슬롯 | GET/PATCH/DELETE /api/schedule-slots/:id | 조회/수정/삭제 |
| 예약 | GET/POST /api/reservations | 목록/등록 (동시간대 6명 검증) |
| 예약 | PATCH /api/reservations/:id/cancel | 취소 |
| 예약 | PATCH /api/reservations/:id/move | 슬롯 변경 |
| 예약 | PATCH /api/reservations/:id/complete | 수업 완료 |
| 정산 | GET /api/payrolls | 목록 (year_month, instructor_id) |
| 정산 | POST /api/payrolls/compute | 월별 정산 계산 |
| 정산 | GET /api/payrolls/:instructorId/:yearMonth | 강사별 월 정산 |

## 문서

- [ERD](docs/ERD.md) - DB 엔티티 관계
- [시스템 매뉴얼](docs/MANUAL.md) - 사용 가이드
