-- ============================================================
-- UCRSystem Database Schema
-- UNICROSS University Course Registration System
-- ============================================================

CREATE DATABASE IF NOT EXISTS ucrsystem CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ucrsystem;

-- ------------------------------------------------------------
-- 1. USERS (students, lecturers, administrators)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(180)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('student','lecturer','admin') NOT NULL DEFAULT 'student',
  department    VARCHAR(100)  NOT NULL DEFAULT '',
  level         TINYINT UNSIGNED NULL COMMENT '100/200/300/400 — students only',
  matric_no     VARCHAR(30)   NULL UNIQUE COMMENT 'students only',
  staff_id      VARCHAR(30)   NULL UNIQUE COMMENT 'lecturers/admins only',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. COURSES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)   NOT NULL UNIQUE,
  title         VARCHAR(200)  NOT NULL,
  credit_units  TINYINT UNSIGNED NOT NULL DEFAULT 3,
  department    VARCHAR(100)  NOT NULL DEFAULT '',
  level         TINYINT UNSIGNED NOT NULL DEFAULT 100 COMMENT '100/200/300/400',
  description   TEXT          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dept_level (department, level)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. COURSE PREREQUISITES (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_prerequisites (
  course_id            INT UNSIGNED NOT NULL,
  prerequisite_id      INT UNSIGNED NOT NULL,
  PRIMARY KEY (course_id, prerequisite_id),
  CONSTRAINT fk_cp_course FOREIGN KEY (course_id)
    REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_prereq FOREIGN KEY (prerequisite_id)
    REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. VENUES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL UNIQUE,
  capacity  SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  building  VARCHAR(80)  NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. TIMETABLE (course offerings per semester)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id   INT UNSIGNED NOT NULL,
  lecturer_id INT UNSIGNED NOT NULL,
  venue_id    INT UNSIGNED NOT NULL,
  semester    VARCHAR(20)  NOT NULL COMMENT 'e.g. 2024/2025-1',
  day         ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tt_course   FOREIGN KEY (course_id)   REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_tt_venue    FOREIGN KEY (venue_id)    REFERENCES venues(id)  ON DELETE RESTRICT,
  INDEX idx_tt_semester (semester),
  INDEX idx_tt_course   (course_id),
  INDEX idx_tt_lecturer (lecturer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. REGISTRATIONS (student course registrations)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id    INT UNSIGNED NOT NULL,
  course_id     INT UNSIGNED NOT NULL,
  semester      VARCHAR(20)  NOT NULL,
  status        ENUM('pending','confirmed','dropped') NOT NULL DEFAULT 'confirmed',
  registered_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reg (student_id, course_id, semester),
  CONSTRAINT fk_reg_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_course  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_reg_semester (semester),
  INDEX idx_reg_student  (student_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. COMPLETED COURSES (historical — source of truth for prereqs)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS completed_courses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id  INT UNSIGNED NOT NULL,
  course_id   INT UNSIGNED NOT NULL,
  grade       CHAR(2)      NOT NULL COMMENT 'A/B/C/D/F',
  semester    VARCHAR(20)  NOT NULL,
  UNIQUE KEY uq_cc (student_id, course_id, semester),
  CONSTRAINT fk_cc_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_course  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_cc_student (student_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. CREDIT POLICY (single-row config table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_policy (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  min_credits TINYINT UNSIGNED NOT NULL DEFAULT 12,
  max_credits TINYINT UNSIGNED NOT NULL DEFAULT 24,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO credit_policy (min_credits, max_credits) VALUES (12, 24)
  ON DUPLICATE KEY UPDATE min_credits=12, max_credits=24;
