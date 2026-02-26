# 카카오 알림톡 실제 발송 – 상세 설정 가이드

알림톡을 **실제로 발송**하려면 아래 순서대로 진행하면 됩니다.

---

## 1단계: 알림톡 서비스 가입

카카오 알림톡은 **카카오 비즈니스** 또는 **알림톡 파트너사**를 통해 이용합니다.

### 방법 A: 카카오 비즈니스 직접

1. **[카카오 비즈니스](https://business.kakao.com)** 접속 후 로그인
2. **메시지** → **알림톡** 메뉴에서 알림톡 서비스 신청
3. 발신 프로필·채널 생성 후 **발신번호** 등록 (이후 템플릿 등록 시 사용)
4. **개발자 콘솔** 또는 **API 연동** 메뉴에서 **API 키**, **발송 API URL** 확인  
   - 문서에 나온 **REST API 엔드포인트**를 그대로 `.env`의 `KAKAO_ALIMTALK_API_URL`에 넣습니다.

### 방법 B: 파트너사(API PLEX, 네이버 SENS 등) 이용

- 파트너사 가입 후 알림톡 발송 권한·발신번호 등록
- 해당 사의 **개발자 문서**에서 **발송 API URL**, **인증 방식(API 키 등)** 확인
- 우리 프로젝트는 **POST + JSON** 방식이라, 업체 문서의 “메시지 발송” API 주소를 `KAKAO_ALIMTALK_API_URL`에 넣으면 됩니다.

> ⚠️ 업체마다 **요청 body/헤더 형식**이 다릅니다. 아래 4단계에서 우리가 보내는 형식을 확인한 뒤, 필요하면 `backend/services/notification.js`를 해당 API 스펙에 맞게 수정해야 합니다.

---

## 2단계: 템플릿 등록 및 승인

알림톡은 **승인된 템플릿**으로만 발송할 수 있습니다. 아래 3종을 등록합니다.

### 2-1. 예약 확정 템플릿

- **용도:** 예약 생성 시, 또는 예약 시간 이동 시(이동 알림 발송 체크 시)
- **템플릿 문구 예시:**
  ```
  [#{회원명}]님, 필라테스 예약이 확정되었습니다.
  일시: #{날짜} #{시간}
  강사: #{강사명}
  ```
- 템플릿 등록 시 **변수**를 반드시 아래 이름으로 맞춰 주세요.  
  (다른 이름을 쓰면 우리 서버에서 치환되지 않습니다.)

  | 변수명 | 설명 | 우리 시스템에서 넣는 값 |
  |--------|------|-------------------------|
  | `회원명` | 회원 이름 | 회원(멤버) 이름 |
  | `날짜` | 수업 날짜 | 예: 2025-02-26 |
  | `시간` | 수업 시작 시간 | 예: 09:00 |
  | `강사명` | 강사 이름 | 해당 수업 강사 이름 |

- 승인 완료 후 발급되는 **템플릿 코드**를 복사해 두었다가, 3단계에서 `KAKAO_ALIMTALK_TEMPLATE_CONFIRMED`에 넣습니다.

### 2-2. 예약 취소 템플릿

- **용도:** 예약 취소 시
- **템플릿 문구 예시:**
  ```
  [#{회원명}]님, 필라테스 예약이 취소되었습니다.
  일시: #{날짜} #{시간}
  ```
- **변수:** `회원명`, `날짜`, `시간` (이름 그대로 사용)
- 승인 후 **템플릿 코드** → `KAKAO_ALIMTALK_TEMPLATE_CANCELLED`에 입력

### 2-3. 리마인더 템플릿

- **용도:** 수업 시작 1시간 전 자동 발송
- **템플릿 문구 예시:**
  ```
  [#{회원명}]님, 오늘 필라테스 수업이 #{시간}에 있습니다.
  날짜: #{날짜}
  ```
- **변수:** `회원명`, `날짜`, `시간`
- 승인 후 **템플릿 코드** → `KAKAO_ALIMTALK_TEMPLATE_REMINDER`에 입력

> 💡 카카오/파트너사 콘솔에서 변수 표기만 다를 수 있습니다 (예: `#{회원명}` vs `{{회원명}}`).  
> 우리 서버는 **한글 키** `회원명`, `날짜`, `시간`, `강사명`으로 JSON을 보냅니다.  
> 템플릿 쪽 변수명을 이 한글 이름과 1:1로 맞추면 됩니다.

---

## 3단계: API 키·URL 확인

- **카카오 비즈니스** 또는 **파트너사 개발자 문서**에서 다음을 확인합니다.
  - **알림톡 발송용 API URL** (예: `https://api.xxx.com/v1/alimtalk/send`)
  - **인증 방식**
    - API 키 1개만 쓰는 경우: 그 값을 `KAKAO_ALIMTALK_API_KEY`에 넣습니다.
    - Bearer 토큰을 쓰는 경우: 문서대로 토큰을 발급받아 `KAKAO_ALIMTALK_API_KEY`에 넣거나, 필요하면 코드에서 토큰 발급 후 `Authorization: Bearer ...`로 보내도록 수정합니다.
  - **요청 body 형식** (필드명: template_code / receiver / template_params 등)  
    → 우리 코드와 다르면 4단계에서 `notification.js`를 수정해야 합니다.

---

## 4단계: 우리 서버가 보내는 형식 (참고)

실제 발송 시 `backend/services/notification.js`는 대략 아래와 같은 형태로 요청합니다.

- **URL:** `KAKAO_ALIMTALK_API_URL` 값
- **Method:** `POST`
- **Headers:**  
  - `Content-Type: application/json`  
  - `Authorization: Bearer (KAKAO_ALIMTALK_API_KEY)`  
  - (일부 업체는 `X-API-Key` 등 다른 헤더 사용)
- **Body 예시:**
  ```json
  {
    "template_code": "승인받은_템플릿_코드",
    "receiver": "01012345678",
    "template_params": {
      "회원명": "홍길동",
      "날짜": "2025-02-26",
      "시간": "09:00",
      "강사명": "김필라"
    }
  }
  ```

사용하는 업체 API 문서의 필드명(template_code / receiver / template_params 등)이 위와 다르면, `backend/services/notification.js`의 `sendViaApi` 함수에서 **필드명과 헤더**만 해당 스펙에 맞게 바꿔 주면 됩니다.

---

## 5단계: .env 설정

`backend` 폴더의 **`.env`** 파일을 열어 아래 항목을 채웁니다.

```env
# 알림톡 사용 여부 (실제 발송하려면 반드시 true)
KAKAO_ALIMTALK_ENABLED=true

# 발송 API 주소 (카카오 또는 파트너사 문서에 나온 URL 전체)
KAKAO_ALIMTALK_API_URL=https://api.사용하는업체.com/v1/alimtalk/send

# API 인증 키 (Bearer 토큰이면 그대로, API 키만 쓰는 업체면 해당 키)
KAKAO_ALIMTALK_API_KEY=발급받은_API_키_또는_토큰

# 2단계에서 승인받은 템플릿 코드를 그대로 복사
KAKAO_ALIMTALK_TEMPLATE_CONFIRMED=예약확정_템플릿코드
KAKAO_ALIMTALK_TEMPLATE_CANCELLED=예약취소_템플릿코드
KAKAO_ALIMTALK_TEMPLATE_REMINDER=리마인더_템플릿코드
```

### 예시 (값만 채운 경우)

```env
KAKAO_ALIMTALK_ENABLED=true
KAKAO_ALIMTALK_API_URL=https://api.example.com/kakao/v2/send
KAKAO_ALIMTALK_API_KEY=sk_live_xxxxxxxxxxxx
KAKAO_ALIMTALK_TEMPLATE_CONFIRMED=TM_001
KAKAO_ALIMTALK_TEMPLATE_CANCELLED=TM_002
KAKAO_ALIMTALK_TEMPLATE_REMINDER=TM_003
```

- **KAKAO_ALIMTALK_ENABLED**  
  - `true` → 위 URL/키/템플릿으로 실제 발송 시도  
  - `false` 또는 비어 있음 → 발송하지 않고 로그만 출력(스텁)
- **템플릿 코드**는 카카오(또는 파트너사) 콘솔에 표시되는 **영문/숫자 코드**를 그대로 넣으면 됩니다.

---

## 6단계: 서버 재시작 및 확인

1. `.env` 저장 후 **백엔드 서버를 한 번 재시작**합니다.  
   ```bash
   cd backend
   npm run dev
   ```
2. **예약 확정** 또는 **예약 취소**를 한 번 진행해 봅니다.
3. 해당 회원의 **연락처(휴대폰 번호)**가 회원 관리에 올바로 들어 있어야 알림톡이 발송됩니다.
4. 발송 실패 시:
   - 터미널에 `Alimtalk send error:` 로그가 나오면, 에러 메시지와 업체 문서를 비교해 보세요.
   - **401/403** → API 키·URL 확인  
   - **400** → body 필드명·템플릿 코드·변수명이 업체 스펙과 일치하는지 확인  
   - 업체 body 형식이 우리와 다르면 `notification.js`의 `sendViaApi`를 해당 API 스펙에 맞게 수정해야 합니다.

---

## 요약 체크리스트

- [ ] 카카오 비즈니스 또는 알림톡 파트너사 가입
- [ ] 발신 프로필·발신번호 등록
- [ ] 예약 확정 / 예약 취소 / 리마인더 템플릿 3개 등록·승인 (변수: 회원명, 날짜, 시간, 강사명)
- [ ] API URL·API 키 확인
- [ ] `backend/.env`에 6개 항목 입력, `KAKAO_ALIMTALK_ENABLED=true` 설정
- [ ] 백엔드 재시작 후 예약 확정/취소로 실제 발송 테스트
- [ ] (선택) 업체 API 형식이 다르면 `notification.js` 수정

이 순서대로 하면 알림톡 실제 발송까지 설정할 수 있습니다.
