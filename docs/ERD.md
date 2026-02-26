# Pilates Scheduler & Payroll - ERD

## 엔티티 관계 개요

```
[User] 1 ---- * [Instructor] (관리자가 강사 등록)
[Instructor] 1 ---- * [ScheduleSlot] (강사별 수업 가능 슬롯)
[Instructor] 1 ---- * [Member] (담당 강사 매핑, 선택)
[ScheduleSlot] 1 ---- * [Reservation] (슬롯당 예약, 최대 6명)
[Member] 1 ---- * [Reservation] (회원별 예약)
[Instructor] 1 ---- * [Payroll] (강사별 월 정산)
```

---

## 1. User (시스템 사용자 - 로그인)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, INT | 자동증가 |
| email | VARCHAR(255), UNIQUE | 로그인 이메일 |
| password_hash | VARCHAR(255) | bcrypt 해시 |
| role | ENUM('admin','instructor') | 역할 |
| instructor_id | FK, INT, NULL | role=instructor일 때 연결된 강사 ID |
| created_at | DATETIME | |
| updated_at | DATETIME | |

- 관리자(admin): instructor_id = NULL, 전체 메뉴 접근
- 강사(instructor): instructor_id로 Instructor와 1:1 연결, 본인 스케줄/예약만

---

## 2. Instructor (강사)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, INT | |
| name | VARCHAR(100) | 강사명 |
| color | VARCHAR(7) | 캘린더 색상 (예: #3498db) |
| rate_type | ENUM('percent','fixed') | 요율 방식: % 또는 금액 |
| rate_value | DECIMAL(10,2) | 수업당 요율 (% 또는 원) |
| base_salary | DECIMAL(12,0), DEFAULT 0 | 월 기본급 (선택) |
| phone | VARCHAR(20), NULL | 연락처 (알림톡용) |
| active | TINYINT(1), DEFAULT 1 | 사용 여부 |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## 3. Member (회원)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, INT | |
| name | VARCHAR(100) | 회원명 |
| phone | VARCHAR(20), NULL | 연락처 (알림톡용) |
| instructor_id | FK, INT, NULL | 담당 강사 (선택) |
| memo | TEXT, NULL | 비고 |
| active | TINYINT(1), DEFAULT 1 | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## 4. ScheduleSlot (수업 가능 시간 슬롯)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, INT | |
| instructor_id | FK, INT | 강사 |
| slot_date | DATE | 날짜 |
| start_time | TIME | 시작 시간 |
| end_time | TIME | 종료 시간 |
| max_capacity | INT, DEFAULT 6 | 최대 수용 인원 (기본 6명) |
| created_at | DATETIME | |
| updated_at | DATETIME | |

- UNIQUE(instructor_id, slot_date, start_time) 또는 비즈니스 검증으로 동일 강사 동일 시간 중복 방지

---

## 5. Reservation (예약)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, INT | |
| schedule_slot_id | FK, INT | 슬롯 |
| member_id | FK, INT | 회원 |
| status | ENUM('confirmed','cancelled') | 예약 확정 / 취소 |
| completed | TINYINT(1), DEFAULT 0 | 수업 완료 여부 (정산 반영용) |
| reminder_sent_at | DATETIME, NULL | 리마인더 발송 시각 |
| created_at | DATETIME | |
| updated_at | DATETIME | |

- 동일 schedule_slot_id에 대해 status='confirmed'인 건수가 max_capacity(6) 초과 불가

---

## 6. Payroll (정산 이력)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, INT | |
| instructor_id | FK, INT | 강사 |
| year_month | CHAR(7) | YYYY-MM |
| class_count | INT | 수업 진행 횟수 (취소 제외, 완료 기준) |
| rate_amount | DECIMAL(12,0) | 수업료 합계 (횟수×요율) |
| base_salary | DECIMAL(12,0) | 해당 월 기본급 |
| total_amount | DECIMAL(12,0) | 총 지급액 |
| created_at | DATETIME | |
| updated_at | DATETIME | |

- UNIQUE(instructor_id, year_month): 강사별 월 1건

---

## 관계 요약

| 부모 | 자식 | 관계 |
|------|------|------|
| User | Instructor | 0..1 (instructor만) |
| Instructor | ScheduleSlot | 1:N |
| Instructor | Member (담당) | 1:N |
| Instructor | Payroll | 1:N |
| ScheduleSlot | Reservation | 1:N (≤ max_capacity) |
| Member | Reservation | 1:N |
