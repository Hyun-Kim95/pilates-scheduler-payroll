# Vercel + Railway 배포 가이드

- **Vercel**: 프론트엔드(React)만 배포
- **Railway**: 백엔드(Express) + MySQL 배포

---

## 1. Railway에 백엔드 + DB 올리기

### 1-1. Railway 로그인 & 프로젝트 생성

1. [railway.app](https://railway.app) 접속 후 **Login** (GitHub로 로그인 권장).
2. 대시보드에서 **New Project** 버튼 클릭.

---

### 1-2. MySQL 추가

1. 프로젝트 안에서 **"+ New"** 또는 **"Add Service"** 클릭.
2. **"Database"** 선택 → 목록에서 **"MySQL"** 선택.
3. 잠시 후 MySQL 서비스가 생성됨. 서비스 카드 클릭.
4. 상단 탭에서 **"Variables"** 선택.
5. 여기에 Railway가 넣어 둔 변수들이 보입니다. **나중에 백엔드에 복사할 값**이므로 그대로 두고, 아래 항목만 메모해 두세요:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`  
   (각 값 옆 **복사 아이콘**으로 복사 가능)

---

### 1-3. 백엔드 서비스 추가 (GitHub 연동)

1. 왼쪽 상단 **"< Project"** 등으로 프로젝트 뷰로 돌아가기.
2. 다시 **"+ New"** → 이번에는 **"GitHub Repo"** 선택.
3. GitHub 권한 허용 후, **이 프로젝트 저장소**(pilates-scheduler-payroll 등) 선택.
4. 저장소가 연결되면 새 서비스가 하나 생깁니다. **이 서비스(백엔드)** 를 클릭.

---

### 1-4. 백엔드가 backend 폴더만 보도록 설정

1. 백엔드 서비스 화면에서 **"Settings"** 탭 클릭.
2. **"Root Directory"** / **"Source"** 섹션 찾기.
3. **"Set root directory"** 또는 입력란에 **`backend`** 입력 후 적용.  
   → 빌드·실행이 저장소의 `backend` 폴더 기준으로 됩니다.
4. **Start Command**가 비어 있으면 **`npm start`** 또는 **`node server.js`** 로 설정 (Railway가 `package.json`의 `start` 스크립트를 쓰는 경우도 있음).

---

### 1-5. 환경 변수 넣기 (백엔드 서비스)

1. 같은 백엔드 서비스에서 **"Variables"** 탭 클릭.
2. **"Add Variable"** 또는 **"RAW Editor"** 로 아래 변수를 **이름 = 값** 형태로 추가.

| 변수 이름 | 넣을 값 |
|-----------|--------|
| `DB_HOST` | 1-2에서 메모한 **MYSQLHOST** 값 (예: `containers-us-west-xxx.railway.app`) |
| `DB_PORT` | **MYSQLPORT** (예: `12345`) |
| `DB_USER` | **MYSQLUSER** (예: `root`) |
| `DB_PASSWORD` | **MYSQLPASSWORD** (긴 문자열 그대로 복사) |
| `DB_NAME` | **MYSQLDATABASE** (예: `railway`) |
| `JWT_SECRET` | 아무 랜덤 문자열 (예: `mySecretKey123!@#`) |
| `FRONTEND_URL` | 아직 모르면 `https://temp.vercel.app` 등 임시 값. **2단계에서 Vercel 배포 후** 실제 URL로 바꿀 예정. |

3. **Save** 또는 **Update** 후 저장.

---

### 1-6. 공개 URL 만들기 (백엔드)

1. 백엔드 서비스 **"Settings"** 탭으로 이동.
2. **"Networking"** / **"Public Networking"** 섹션 찾기.
3. **"Generate Domain"** 버튼 클릭 → `https://xxxx.up.railway.app` 형태의 URL이 생성됨.
4. 이 **URL 전체를 복사**해 두기. (2단계 Vercel에서 `VITE_API_URL`에 `이 URL + /api` 로 씀.)

---

### 1-7. 배포 확인

1. **"Deployments"** 탭에서 최신 배포가 **Success**인지 확인.
2. 실패하면 **로그**를 열어 에러 메시지 확인 (대부분 `DB_*` 변수 오타나 Root Directory 미설정).
3. 성공 후 브라우저에서 `https://방금복사한URL/api/health` 로 접속해  
   `{"ok":true,"message":"Pilates Scheduler API"}` 비슷한 응답이 나오면 백엔드는 정상 동작.

---

### ⚠️ "There was an error deploying from source" 나올 때

저장소 **루트**에는 `package.json`이 없고 **backend** 폴더 안에만 있어서, Root Directory를 안 넣으면 Railway가 앱을 못 찾고 이 오류가 납니다.

**해결:**

1. 실패한 **백엔드 서비스** 클릭 (GitHub Repo로 추가한 그 서비스).
2. **Settings** 탭으로 이동.
3. **Source** / **Root Directory** 섹션 찾기.
4. **"Configure"** 또는 입력란에 **`backend`** 입력 후 저장.
5. **Deployments** 탭에서 **"Redeploy"** 또는 **"Deploy"** 다시 실행.

그래도 실패하면 **Deployments** → 맨 위(최신) 배포 클릭 → **View Logs**에서 빨간색 에러 메시지를 확인해 보세요.

---

### 1-8. DB 테이블 만들기 (최초 1회)

Railway MySQL은 서비스만 만들면 DB는 비어 있습니다. 테이블을 만들어야 합니다.

**방법 A – 로컬에서 스키마 + 시드 실행 (권장)**

1. 로컬 `backend/.env`를 **일시적으로** Railway MySQL 값으로 수정:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 만 Railway Variables와 동일하게.
2. **테이블 생성**: MySQL 클라이언트로 Railway DB 접속 후 `backend/db/schema.sql` 내용 실행  
   (또는 `mysql -h DB_HOST -P DB_PORT -u DB_USER -p DB_NAME < backend/db/schema.sql`).
3. **더미 데이터**(선택): 터미널에서
   ```bash
   cd backend
   node scripts/seed-dummy.js
   ```
4. 완료 후 로컬 `.env`는 다시 로컬용으로 되돌려도 됨.

**방법 B – MySQL 클라이언트로만**

- Railway MySQL **Variables**의 연결 정보로 Workbench, DBeaver, `mysql` CLI 등 접속.
- `backend/db/schema.sql` 실행해 테이블 생성.
- (선택) 관리자 계정이 필요하면 `backend/scripts/seed-admin.js` 등 추가 실행.

---

### 1-9. 더미 데이터 넣기 (강사/회원/슬롯/예약)

Railway DB에 접속할 수 있는 **공개(Public) 호스트**가 있을 때만 로컬에서 실행 가능합니다.

**방법 A – 로컬에서 실행 (DBeaver 연결에 쓴 Host 사용)**

1. Railway MySQL 서비스 → **Connect** 또는 **Networking**에서 **Public** 접속용 Host/Port 확인.  
   (DBeaver에 연결할 때 쓴 Host가 그 값입니다.)
2. `backend/.env`를 **잠시** 아래처럼 수정:
   - `DB_HOST` = 위에서 확인한 **Public Host** (예: `containers-us-west-123.railway.app`)
   - `DB_PORT` = Public Port (보통 3306 또는 표시된 값)
   - `DB_USER` / `DB_PASSWORD` / `DB_NAME` = Railway Variables와 동일
3. 터미널에서:
   ```bash
   cd backend
   node scripts/seed-dummy.js
   ```
4. 완료 후 `.env`는 로컬용으로 되돌리기.

**방법 B – Railway CLI로 실행**

1. [Railway CLI](https://docs.railway.app/develop/cli) 설치 후 `railway login`, 프로젝트에서 `railway link`로 백엔드 서비스 연결.
2. `backend` 폴더에서:
   ```bash
   railway run node scripts/seed-dummy.js
   ```
   (Railway 환경 변수로 DB에 접속하므로 내부 호스트 사용 가능.)

---

## 2. Vercel에 프론트엔드 올리기

### 2-1. Vercel 로그인 & 프로젝트 가져오기

1. [vercel.com](https://vercel.com) 접속 후 **Login** (GitHub 권장).
2. 대시보드에서 **"Add New"** → **"Project"** 클릭.
3. **"Import Git Repository"**에서 **이 프로젝트 저장소**(Hyun-Kim95/pilates-scheduler-payroll 등) 선택.
4. **"Import"** 클릭.

---

### 2-2. Root Directory 반드시 설정

1. Import 후 **"Configure Project"** 화면이 나옵니다.
2. **"Root Directory"** 항목 찾기 (Framework Preset 아래 쯤).
3. **"Edit"** 클릭 → 입력란에 **`frontend`** 입력 후 **"Continue"**.
4. 이렇게 해야 Vercel이 `frontend` 폴더 안의 `package.json`을 보고 Vite로 빌드합니다.  
   (설정 안 하면 루트에서 빌드하려다 실패할 수 있음.)

---

### 2-3. Build 설정 확인

같은 Configure 화면에서 아래만 맞으면 됩니다 (보통 자동 감지됨).

| 항목 | 값 |
|------|-----|
| **Framework Preset** | Vite (자동일 수 있음) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

바꿀 게 없으면 그대로 두면 됩니다.

---

### 2-4. 환경 변수 추가 (배포 전에)

1. **"Environment Variables"** 섹션 펼치기.
2. **Key**에 **`VITE_API_URL`** 입력.
3. **Value**에 **1단계에서 복사한 Railway 백엔드 URL + `/api`** 넣기.  
   예: `https://pilates-scheduler-api-production-xxxx.up.railway.app/api`  
   (끝에 **`/api`** 꼭 붙이기. 슬래시 하나만.)
4. Environment는 **Production**(또는 All) 선택 후 **Add** 또는 **Save**.

---

### 2-5. 배포 실행

1. **"Deploy"** 버튼 클릭.
2. 빌드 로그가 나오며 1~2분 정도 걸립니다.
3. 끝나면 **"Congratulations"** 화면과 함께 **배포 URL**이 나옵니다.  
   예: `https://pilates-scheduler-xxxx.vercel.app`
4. 이 **URL 전체를 복사**해 두기. (다음 단계에서 Railway `FRONTEND_URL`에 넣을 값.)

---

### 2-6. (선택) 나중에 환경 변수 넣었을 때

처음에 `VITE_API_URL`을 안 넣고 Deploy 했다면:

1. Vercel 대시보드에서 해당 프로젝트 클릭.
2. **Settings** → **Environment Variables**.
3. **Add** → `VITE_API_URL` = `https://Railway백엔드URL/api` 저장.
4. **Deployments** 탭 → 맨 위 배포 오른쪽 **⋯** → **Redeploy** 해야 새 값이 반영됩니다.

---

## 3. 마지막: Railway CORS 맞추기 & 동작 확인

### 3-1. Railway에 FRONTEND_URL 넣기

Vercel URL이 생겼으면, 백엔드가 “이 주소에서 오는 요청만 허용”하도록 설정해야 합니다.

1. [railway.app](https://railway.app) → 해당 프로젝트 → **백엔드 서비스**(GitHub Repo로 추가한 것) 클릭.
2. **"Variables"** 탭 클릭.
3. **`FRONTEND_URL`** 찾기.
   - 이미 `https://temp.vercel.app` 등으로 넣었다면: **값을 2단계에서 복사한 Vercel URL로 수정.**  
     예: `https://pilates-scheduler-xxxx.vercel.app`  
     (끝에 슬래시 없이, `https://` 포함.)
   - 없다면: **Add Variable** → Name `FRONTEND_URL`, Value에 Vercel URL 입력.
4. **Save** 또는 **Update** 후 저장.  
   → Railway가 자동으로 재배포합니다. 1~2분 기다리면 됩니다.

---

### 3-2. 브라우저에서 확인

1. 브라우저에서 **Vercel URL** 접속.  
   예: `https://pilates-scheduler-xxxx.vercel.app`
2. **로그인** 시도.  
   - 1-8에서 시드(seed-admin, seed-dummy) 실행했다면 더미 계정으로 로그인 가능.  
   - 관리자: `backend/scripts/seed-admin.js`에 적힌 이메일/비밀번호 등.
3. 로그인 후 **예약 목록**, **스케줄**, **통계** 등 메뉴 눌러 보며 동작 확인.
4. **CORS 에러**가 나면 (콘솔에 빨간 글씨):  
   - Railway `FRONTEND_URL`이 Vercel URL과 **완전히 같은지** (http/https, 끝 슬래시 없음) 확인.  
   - 저장 후 재배포 끝났는지 확인.

---

### 3-3. 정리 체크리스트

- [ ] Railway 백엔드: Root Directory = `backend`, Variables(DB_*, JWT_SECRET, FRONTEND_URL) 설정됨.
- [ ] Railway: `https://백엔드URL/api/health` 접속 시 `{"ok":true,...}` 나옴.
- [ ] Vercel: Root Directory = `frontend`, `VITE_API_URL` = `https://백엔드URL/api`.
- [ ] Railway `FRONTEND_URL` = Vercel 배포 URL(예: `https://xxx.vercel.app`).
- [ ] 브라우저에서 Vercel URL로 접속해 로그인·메뉴 동작 확인.

---

## 요약

| 구분 | 서비스 | 설정 포인트 |
|------|--------|-------------|
| 프론트 | Vercel | Root Directory = `frontend`, `VITE_API_URL` = Railway URL + `/api` |
| 백엔드+DB | Railway | Root Directory = `backend`, `DB_*`·`JWT_SECRET`·`FRONTEND_URL` (Vercel URL) |
