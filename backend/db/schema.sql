-- Pilates Scheduler & Payroll - DB Schema
-- MySQL / MariaDB

CREATE DATABASE IF NOT EXISTS pilates_scheduler
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE pilates_scheduler;

-- 1. Users (로그인 계정)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'instructor') NOT NULL DEFAULT 'instructor',
  instructor_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_instructor_id (instructor_id)
);

-- 2. Instructors (강사)
CREATE TABLE instructors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#3498db',
  rate_type ENUM('percent', 'fixed') NOT NULL DEFAULT 'fixed',
  rate_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  base_salary DECIMAL(12, 0) NOT NULL DEFAULT 0,
  phone VARCHAR(20) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (active)
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_instructor
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;

-- 3. Members (회원)
CREATE TABLE members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  instructor_id INT NULL,
  memo TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instructor_id (instructor_id),
  INDEX idx_active (active),
  CONSTRAINT fk_members_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL
);

-- 4. Schedule Slots (수업 가능 시간)
CREATE TABLE schedule_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INT NOT NULL DEFAULT 6,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instructor_date (instructor_id, slot_date),
  INDEX idx_slot_date (slot_date),
  CONSTRAINT fk_slots_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
);

-- 5. Reservations (예약)
CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_slot_id INT NOT NULL,
  member_id INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  completed TINYINT(1) NOT NULL DEFAULT 0,
  reminder_sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slot_status (schedule_slot_id, status),
  INDEX idx_member (member_id),
  CONSTRAINT fk_reservations_slot
    FOREIGN KEY (schedule_slot_id) REFERENCES schedule_slots(id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_member
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 6. Payroll (정산 이력)
CREATE TABLE payrolls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  `year_month` CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  class_count INT NOT NULL DEFAULT 0,
  rate_amount DECIMAL(12, 0) NOT NULL DEFAULT 0,
  base_salary DECIMAL(12, 0) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 0) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_instructor_month (instructor_id, `year_month`),
  CONSTRAINT fk_payrolls_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
);
