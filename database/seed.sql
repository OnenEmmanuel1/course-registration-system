-- ============================================================
-- UCRSystem Seed Data
-- UNICROSS University Course Registration System
-- ============================================================
USE ucrsystem;

-- ============================================================
-- CREDIT POLICY
-- ============================================================
INSERT INTO credit_policy (id, min_credits, max_credits) VALUES (1, 12, 24)
  ON DUPLICATE KEY UPDATE min_credits=VALUES(min_credits), max_credits=VALUES(max_credits);

-- ============================================================
-- VENUES (4 venues, varying capacity)
-- ============================================================
INSERT IGNORE INTO venues (name, capacity, building) VALUES
  ('LT-A (Main Lecture Theatre)', 250, 'Faculty of Science Block'),
  ('Room 101', 60, 'Computer Science Building'),
  ('Room 202', 45, 'Engineering Block'),
  ('Seminar Hall B', 30, 'General Studies Building');

-- ============================================================
-- COURSES (core prerequisite examples plus multi-department sample courses)
-- ============================================================
-- Level 100 (no prerequisites)
INSERT IGNORE INTO courses (code, title, credit_units, department, level, description) VALUES
  ('CSC101', 'Introduction to Computer Science', 3, 'Computer Science', 100,
   'Foundations of computing, algorithms, and problem solving.'),
  ('MTH101', 'Elementary Mathematics I', 3, 'Mathematics', 100,
   'Number theory, sets, functions, and introductory calculus.'),
  ('GNS101', 'Communication Skills', 2, 'General Studies', 100,
   'Academic writing, oral communication, and critical thinking.');

-- Level 200 (prerequisite: CSC101 or MTH101)
INSERT IGNORE INTO courses (code, title, credit_units, department, level, description) VALUES
  ('CSC201', 'Data Structures and Algorithms', 3, 'Computer Science', 200,
   'Arrays, linked lists, trees, graphs, sorting and searching algorithms.'),
  ('CSC202', 'Object-Oriented Programming', 3, 'Computer Science', 200,
   'OOP principles using Java: classes, inheritance, polymorphism.'),
  ('MTH201', 'Linear Algebra', 3, 'Mathematics', 200,
   'Vectors, matrices, determinants, eigenvalues.');

-- Level 300 (prerequisites: CSC201 + CSC202)
INSERT IGNORE INTO courses (code, title, credit_units, department, level, description) VALUES
  ('CSC301', 'Database Systems', 3, 'Computer Science', 300,
   'Relational model, SQL, normalization, transactions, and concurrency.'),
  ('CSC302', 'Operating Systems', 3, 'Computer Science', 300,
   'Process management, memory management, file systems, concurrency.');

-- Additional departments across Science, Engineering, Management Sciences, and Arts.
-- Each department has sample courses at all four levels for registration demos.
INSERT IGNORE INTO courses (code, title, credit_units, department, level, description) VALUES
  ('BIO101', 'General Biology I', 3, 'Biology', 100, 'Cells, genetics, evolution, and biological diversity.'),
  ('BIO201', 'Genetics', 3, 'Biology', 200, 'Principles of inheritance, gene expression, and variation.'),
  ('BIO301', 'Ecology', 3, 'Biology', 300, 'Ecosystems, populations, biodiversity, and conservation.'),
  ('BIO401', 'Advanced Molecular Biology', 3, 'Biology', 400, 'Molecular methods and current topics in biological research.'),
  ('CVE101', 'Engineering Drawing', 2, 'Civil Engineering', 100, 'Technical drawing, projections, and engineering graphics.'),
  ('CVE201', 'Strength of Materials', 3, 'Civil Engineering', 200, 'Stress, strain, material properties, and structural response.'),
  ('CVE301', 'Structural Analysis', 3, 'Civil Engineering', 300, 'Analysis of determinate and indeterminate structures.'),
  ('CVE401', 'Highway Engineering', 3, 'Civil Engineering', 400, 'Highway planning, geometric design, pavement, and drainage.'),
  ('ACC101', 'Introduction to Accounting', 3, 'Accounting', 100, 'Accounting principles, journals, ledgers, and trial balance.'),
  ('ACC201', 'Financial Accounting', 3, 'Accounting', 200, 'Preparation and interpretation of financial statements.'),
  ('ACC301', 'Cost and Management Accounting', 3, 'Accounting', 300, 'Cost behavior, budgeting, and management decision tools.'),
  ('ACC401', 'Auditing', 3, 'Accounting', 400, 'Audit principles, evidence, reporting, and professional practice.'),
  ('MAC101', 'Introduction to Mass Communication', 3, 'Mass Communication', 100, 'Media institutions, communication models, and society.'),
  ('MAC201', 'News Writing and Reporting', 3, 'Mass Communication', 200, 'News gathering, interviewing, and clear news writing.'),
  ('MAC301', 'Broadcast Production', 3, 'Mass Communication', 300, 'Planning and producing radio and television programmes.'),
  ('MAC401', 'Media Law and Ethics', 2, 'Mass Communication', 400, 'Media regulation, law, ethics, and professional responsibility.');

-- ============================================================
-- COURSE PREREQUISITES (chains)
-- CSC201 requires CSC101
-- CSC202 requires CSC101
-- MTH201 requires MTH101
-- CSC301 requires CSC201 AND CSC202 (two prerequisites)
-- CSC302 requires CSC201
-- ============================================================
INSERT IGNORE INTO course_prerequisites (course_id, prerequisite_id)
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
INSERT IGNORE INTO users (name, email, password_hash, role, department, staff_id) VALUES
  ('Dr. Emmanuel Okon', 'admin@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'admin', 'Registry', 'ADM001');

-- Lecturers
INSERT IGNORE INTO users (name, email, password_hash, role, department, staff_id) VALUES
  ('Dr. Amaka Eze', 'amaka.eze@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Computer Science', 'LEC001'),
  ('Prof. Chukwudi Nwosu', 'chukwudi.nwosu@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Mathematics', 'LEC002'),
  ('Dr. Bassey Okoro', 'bassey.okoro@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Biology', 'LEC003'),
  ('Engr. Iniobong Ekpo', 'iniobong.ekpo@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Civil Engineering', 'LEC004'),
  ('Dr. Grace Adebayo', 'grace.adebayo@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Accounting', 'LEC005'),
  ('Mr. Etim Effiong', 'etim.effiong@unicross.edu.ng',
   '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
   'lecturer', 'Mass Communication', 'LEC006');

-- Students (varying completed_courses history)
INSERT IGNORE INTO users (name, email, password_hash, role, department, level, matric_no) VALUES
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

-- Repair level values truncated by older TINYINT schemas.
UPDATE users SET level=300
WHERE role='student' AND email IN ('carol@unicross.edu.ng', 'daniel@unicross.edu.ng');

-- Additional students: this batch adds 10 more for each level (100/200/300/400)
-- in every course department, bringing generated coverage to 20 per department/level.
-- This insert is safe to rerun.
INSERT IGNORE INTO users (name, email, password_hash, role, department, level, matric_no)
SELECT
  CONCAT(d.student_label, ' ', LPAD(n.student_no, 2, '0')),
  CONCAT(LOWER(d.email_prefix), '.l', l.level, '.', LPAD(n.student_no, 2, '0'), '@unicross.edu.ng'),
  '$2b$10$iVQXhf4Bk16qWLMxM9fE.e1oB97o2w8117QmcdsnZCKl4N.KeSo3.',
  'student', d.department, l.level,
  CONCAT('UNICROSS/', d.matric_prefix, '/', 2026 - (l.level DIV 100), '/', LPAD(n.student_no + 10, 3, '0'))
FROM
  (SELECT 'Computer Science' department, 'Computer Science Student' student_label, 'cs' email_prefix, 'CS' matric_prefix
   UNION ALL SELECT 'Mathematics', 'Mathematics Student', 'math', 'MTH'
   UNION ALL SELECT 'General Studies', 'General Studies Student', 'gns', 'GNS'
   UNION ALL SELECT 'Biology', 'Biology Student', 'bio', 'BIO'
   UNION ALL SELECT 'Civil Engineering', 'Civil Engineering Student', 'cve', 'CVE'
   UNION ALL SELECT 'Accounting', 'Accounting Student', 'acc', 'ACC'
   UNION ALL SELECT 'Mass Communication', 'Mass Communication Student', 'mac', 'MAC') d
CROSS JOIN
  (SELECT 100 level UNION ALL SELECT 200 UNION ALL SELECT 300 UNION ALL SELECT 400) l
CROSS JOIN
  (SELECT 11 student_no UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
   UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20) n
LEFT JOIN users existing
  ON existing.email = CONCAT(LOWER(d.email_prefix), '.l', l.level, '.', LPAD(n.student_no, 2, '0'), '@unicross.edu.ng')
WHERE existing.id IS NULL;

-- Give generated upper-level demo students the prerequisites for their level's
-- courses so they can exercise registration without failing prerequisite checks.
INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, cp.prerequisite_id, 'C', '2023/2024-1'
FROM users u
JOIN courses target ON target.department = u.department AND target.level = u.level
JOIN course_prerequisites cp ON cp.course_id = target.id
WHERE u.role = 'student' AND u.email LIKE '%.l%';

-- ============================================================
-- COMPLETED COURSES (prerequisite check source of truth)
-- ============================================================
-- Alice: completed CSC101 only (can attempt CSC201/CSC202 but NOT CSC301)
INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'B', '2023/2024-1'
FROM users u, courses c
WHERE u.email='alice@unicross.edu.ng' AND c.code='CSC101';

INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'A', '2023/2024-1'
FROM users u, courses c
WHERE u.email='alice@unicross.edu.ng' AND c.code='MTH101';

-- Bob: completed CSC101 only — no MTH101, no CSC201, no CSC202
INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, 'C', '2023/2024-1'
FROM users u, courses c
WHERE u.email='bob@unicross.edu.ng' AND c.code='CSC101';

-- Carol: completed CSC101, CSC201, CSC202 — can register CSC301
INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, grade, '2023/2024-1' FROM users u,
(SELECT 'CSC101' code, 'A' grade UNION ALL
 SELECT 'CSC201',     'B'        UNION ALL
 SELECT 'CSC202',     'A'        UNION ALL
 SELECT 'MTH101',     'B'        UNION ALL
 SELECT 'GNS101',     'A') seeds, courses c
WHERE u.email='carol@unicross.edu.ng' AND c.code=seeds.code;

-- Daniel: completed CSC101, CSC201 — NOT CSC202, so CSC301 should FAIL (missing CSC202)
INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
SELECT u.id, c.id, grade, '2023/2024-1' FROM users u,
(SELECT 'CSC101' code, 'B' grade UNION ALL
 SELECT 'CSC201',     'C') seeds, courses c
WHERE u.email='daniel@unicross.edu.ng' AND c.code=seeds.code;

-- Eve: completed MTH101 only (can attempt MTH201)
INSERT IGNORE INTO completed_courses (student_id, course_id, grade, semester)
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
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'MTH101' code, 'chukwudi.nwosu@unicross.edu.ng' lemail,
        'LT-A (Main Lecture Theatre)' vname, 'Tuesday' day,
        '08:00:00' start_time, '10:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'GNS101' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Seminar Hall B' vname, 'Wednesday' day,
        '10:00:00' start_time, '11:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC201' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 101' vname, 'Monday' day,
        '10:00:00' start_time, '12:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC202' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 101' vname, 'Wednesday' day,
        '14:00:00' start_time, '16:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'MTH201' code, 'chukwudi.nwosu@unicross.edu.ng' lemail,
        'Room 202' vname, 'Thursday' day,
        '08:00:00' start_time, '10:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC301' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 202' vname, 'Friday' day,
        '08:00:00' start_time, '11:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
SELECT c.id, l.id, v.id, '2024/2025-1', day, start_time, end_time
FROM courses c, users l, venues v,
(SELECT 'CSC302' code, 'amaka.eze@unicross.edu.ng' lemail,
        'Room 101' vname, 'Friday' day,
        '12:00:00' start_time, '14:00:00' end_time) s
WHERE c.code=s.code AND l.email=s.lemail AND v.name=s.vname
  AND NOT EXISTS (
    SELECT 1 FROM timetable existing
    WHERE existing.course_id=c.id AND existing.lecturer_id=l.id AND existing.venue_id=v.id
      AND existing.semester='2024/2025-1' AND existing.day=s.day
      AND existing.start_time=s.start_time AND existing.end_time=s.end_time
  );

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
