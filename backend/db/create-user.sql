-- Pilates Scheduler 전용 DB 계정 생성
-- MySQL root(또는 관리자)로 실행하세요.
-- 이 계정은 pilates_scheduler DB에만 권한이 있으며, 다른 DB는 접근할 수 없습니다.
-- 비밀번호 '여기에_원하는_비밀번호' 를 꼭 본인이 정한 값으로 바꾼 뒤 실행하세요.

CREATE USER IF NOT EXISTS 'pilates_app'@'localhost'
  IDENTIFIED BY '여기에_원하는_비밀번호';

-- 다른 DB·전역 권한 제거 (이미 있을 수 있는 권한 정리)
REVOKE ALL PRIVILEGES ON *.* FROM 'pilates_app'@'localhost';

-- pilates_scheduler DB에만 권한 부여 (다른 DB는 접근 불가)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER
  ON pilates_scheduler.* TO 'pilates_app'@'localhost';

FLUSH PRIVILEGES;
