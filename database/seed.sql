-- ============================================================
-- UCRSystem Seed Data
-- UNICROSS University Course Registration System
-- ============================================================
USE ucrsystem;

-- ============================================================
-- CREDIT POLICY
-- ============================================================
TRUNCATE TABLE credit_policy;
INSERT INTO credit_policy (min_credits, max_credits) VALUES (12, 24);

-- ============================================================
-- VENUES (4 venues, varying capacity)
-- ============================================================
INSERT INTO venues (name, capacity, building) VALUES
  ('LT-A (Main Lecture Theatre)', 250, 'Faculty of Science Block'),
  ('Room 101', 60, 'Computer Science Building'),
  ('Room 202', 45, 'Engineering Block'),
  ('Seminar Hall B', 30, 'General Studies Building');

-- ============================================================
-- COURSES (8 courses with prerequisite chains)
-- ============================================================
-- Level 100 (no prerequisites)
INSERT INTO courses (code, title, credit_units, department, level, description) VALUES
  ('CSC101', 'Introduction to Computer Science', 3, 'Computer Science', 100,
   'Foundations of computing, algorithms, and problem solving.'),
  ('MTH101', 'Elementary Mathematics I', 3, 'Mathematics', 100,
   'Number theory, sets, functions, and introductory calculus.'),
  ('GNS101', 'Communication Skills', 2, 'General Studies', 100,
   'Academic writing, oral communication, and critical thinking.');

-- Level 200 (prerequisite: CSC101 or MTH101)
INSERT INTO courses (code, title, credit_units, department, level, description) VALUES
  ('CSC201', 'Data Structures and Algorithms', 3, 'Computer Science', 200,
   'Arrays, linked lists, trees, graphs, sorting and searching algorithms.'),
  ('CSC202', 'Object-Oriented Programming', 3, 'Computer Science', 200,
   'OOP principles using Java: classes, inheritance, polymorphism.'),
  ('MTH201', 'Linear Algebra', 3, 'Mathematics', 200,
   'Vectors, matrices, determinants, eigenvalues.');

-- Level 300 (prerequisites: CSC201 + CSC202)
INSERT INTO courses (code, title, credit_units, department, level, description) VALUES
  ('CSC301', 'Database Systems', 3, 'Computer Science', 300,
   'Relational model, SQL, normalization, transactions, and concurrency.'),
  ('CSC302', 'Operating Systems', 3, 'Computer Science', 300,
   'Process management, memory management, file systems, concurrency.');

-- ============================================================
-- COURSE PREREQUISITES (chains)
-- CSC201 requires CSC101
-- CSC202 requires CSC101
-- MTH201 requires MTH101
-- CSC301 requires CSC201 AND CSC202 (two prerequisites)
-- CSC302 requires CSC201
-- ============================================================
INSERT INTO course_prerequisites (course_id, prerequisite_id)
SELECT c.id, p.id FROM courses c, courses p
WHERE (c.code='CSC201' AND p.code='CSC101')
   OR (c.code='CSC202' AND p.code='CSC101')
   OR (c.code='MTH201' AND p.code='MTH101')
   OR (c.code='CSC301' AND p.code='CSC201')
   OR (c.code='CSC301' AND p.code='CSC202')
   OR (c.code='CSC302' AND p.code='CSC201');

-- ============================================================
-- USERS
-- Passwords: all bcrypt hashed of "password123" 
--   hash: $2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.
-- ============================================================

-- Admin
INSERT INTO users (name, email, password_hash, role, department, staff_id) VALUES
  ('Dr. Emmanuel Okon', 'admin@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'admin', 'Registry', 'ADM001');

-- Lecturers
INSERT INTO users (name, email, password_hash, role, department, staff_id) VALUES
  ('Dr. Amaka Eze', 'amaka.eze@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Computer Science', 'LEC001'),
  ('Prof. Chukwudi Nwosu', 'chukwudi.nwosu@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Mathematics', 'LEC002');

-- Students (varying completed_courses history)
INSERT INTO users (name, email, password_hash, role, department, level, matric_no) VALUES
  ('Alice Balogun',    'alice@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'student', 'Computer Science', 200, 'UNICROSS/CS/2023/001'),
  ('Bob Onyekachi',    'bob@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'student', 'Computer Science', 200, 'UNICROSS/CS/2023/002'),
  ('Carol Adeyemi',    'carol@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'student', 'Computer Science', 300, 'UNICROSS/CS/2022/001'),
  ('Daniel Musa',      'daniel@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'student', 'Computer Science', 300, 'UNICROSS/CS/2022/002'),
  ('Eve Okonkwo',      'eve@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'student', 'Mathematics', 200, 'UNICROSS/MTH/2023/001');

-- ============================================================
-- COMPLETED COURSES (prerequisite check source of truth)
-- ============================================================
-- Alice: completed CSC101 only (can attempt CSC201/CSC202 but NOT CSC301)
INSERT INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'B', '2023/2024-1'
FROM users u, courses c
WHERE u.email='alice@unicross.edu.ng' AND c.code='CSC101';

INSERT INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'A', '2023/2024-1'
FROM users u, courses c
WHERE u.email='alice@unicross.edu.ng' AND c.code='MTH101';

-- Bob: completed CSC101 only — no MTH101, no CSC201, no CSC202
INSERT INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'C', '2023/2024-1'
FROM users u, courses c
WHERE u.email='bob@unicross.edu.ng' AND c.code='CSC101';

-- Carol: completed CSC101, CSC201, CSC202 — can register CSC301
INSERT INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, grade, '2023/2024-1' FROM users u,
(SELECT 'CSC101' code, 'A' grade UNION ALL
 SELECT 'CSC201',     'B'        UNION ALL
 SELECT 'CSC202',     'A'        UNION ALL
 SELECT 'MTH101',     'B'        UNION ALL
 SELECT 'GNS101',     'A') seeds, courses c
WHERE u.email='carol@unicross.edu.ng' AND c.code=seeds.code;

-- Daniel: completed CSC101, CSC201 — NOT CSC202, so CSC301 should FAIL (missing CSC202)
INSERT INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, grade, '2023/2024-1' FROM users u,
(SELECT 'CSC101' code, 'B' grade UNION ALL
 SELECT 'CSC201',     'C') seeds, courses c
WHERE u.email='daniel@unicross.edu.ng' AND c.code=seeds.code;

-- Eve: completed MTH101 only (can attempt MTH201)
INSERT INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'B', '2023/2024-1'
FROM users u, courses c
WHERE u.email='eve@unicross.edu.ng' AND c.code='MTH101';

-- ============================================================
-- TIMETABLE ENTRIES (semester 2024/2025-1)
-- ============================================================
INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC101' code, 'amaka.eze@unicross.edu.ng' lemail,
        'LT-A (Main Lecture Theatre)' vname, 'Monday' day,
        '08:00:00' start_time, '10:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'MTH101' code, 'chukwudi.nwosu@unicross.edu.ng' lemail,
        'LT-A (Main Lecture Theatre)' vname, 'Tuesday' day,
        '08:00:00' start_time, '10:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'GNS101' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Seminar Hall B' vname, 'Wednesday' day,
        '10:00:00' start_time, '11:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC201' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 101' vname, 'Monday' day,
        '10:00:00' start_time, '12:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC202' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 101' vname, 'Wednesday' day,
        '14:00:00' start_time, '16:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'MTH201' code, 'chukwudi.nwosu@unicross.edu.ng' lemail,
        'Room 202' vname, 'Thursday' day,
        '08:00:00' start_time, '10:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC301' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 202' vname, 'Friday' day,
        '08:00:00' start_time, '11:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC302' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 101' vname, 'Friday' day,
        '12:00:00' start_time, '14:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname;

-- ============================================================
-- SEEDED REGISTRATIONS (Carol has valid existing registrations)
-- Demonstrates: Carol registered CSC101,MTH101,GNS101 in semester 1
-- In current semester (2024/2025-1) Carol registers advanced courses
-- ============================================================
INSERT INTO registrations (student_id, course_id, semester, status)
SELECT u.id, c.id, '2024/2025-1', 'confirmed'
FROM users u, courses c
WHERE u.email='carol@unicross.edu.ng' AND c.code IN ('GNS101')
ON DUPLICATE KEY UPDATE status='confirmed';

-- ============================================================
-- NOTES ON VALIDATION SCENARIOS (for testing):
-- 1. PREREQUISITE FAILURE: Log in as alice@unicross.edu.ng
--    Try to register CSC301 → FAILS: missing CSC201, CSC202
-- 2. PREREQUISITE FAILURE (partial): Log in as daniel@unicross.edu.ng
--    Try to register CSC301 → FAILS: has CSC201 but missing CSC202
-- 3. CREDIT-LIMIT EXCEEDED: Any student trying to register courses
--    totaling > 24 credit units in one semester
-- 4. SUCCESS: Log in as carol@unicross.edu.ng
--    Can register CSC301 (has all prereqs: CSC201 + CSC202)
-- ============================================================
