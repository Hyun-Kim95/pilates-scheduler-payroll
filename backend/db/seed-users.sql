-- 초기 관리자 계정 생성용 (비밀번호: admin123)
-- bcrypt hash for 'admin123' (run once, then delete or keep for reference)
-- Node: const hash = await bcrypt.hash('admin123', 10);

-- 사용 전에 instructors 테이블이 있어야 하므로, 먼저 schema.sql 실행 후
-- 아래는 예시. 실제 해시는 서버에서 생성해 INSERT 하거나, seed 스크립트 사용 권장.

-- INSERT INTO users (email, password_hash, role, instructor_id) VALUES
-- ('admin@pilates.local', '$2a$10$...', 'admin', NULL);
