'use strict';
const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireRole, noCache } = require('../../middleware/auth');

const router = express.Router();

router.use(requireRole('admin'), noCache, async (req, res, next) => {
  try {
    req.currentSemester = await engine.getCurrentSemester(pool);
    req.semesters = await engine.getAvailableSemesters(pool, req.currentSemester);
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/settings', async (req, res) => {
  const [faculties] = await pool.execute('SELECT id, name FROM faculties ORDER BY name');
  const filterFaculty = String(req.query.faculty_id || '');
  const filterDepartment = String(req.query.department || '');
  let departmentSql =
    `SELECT d.id, d.name, f.name AS faculty_name FROM departments d
     JOIN faculties f ON f.id = d.faculty_id WHERE 1=1`;
  const params = [];
  if (/^\d+$/.test(filterFaculty)) { departmentSql += ' AND d.faculty_id = ?'; params.push(Number(filterFaculty)); }
  if (filterDepartment) { departmentSql += ' AND d.name = ?'; params.push(filterDepartment); }
  departmentSql += ' ORDER BY f.name, d.name';
  const [departmentRows] = await pool.execute(departmentSql, params);
  const [departmentOptions] = await pool.execute('SELECT name FROM departments ORDER BY name');
  res.render('admin/settings', {
    title: 'System Settings — UCRSystem', semester: req.currentSemester, semesters: req.semesters,
    faculties, departments: departmentRows, departmentOptions,
    filterFaculty, filterDepartment,
  });
});

router.post('/settings/faculties', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 120) {
    req.flash('error', 'Enter a faculty name up to 120 characters.');
    return res.redirect('/admin/settings');
  }
  try {
    const [result] = await pool.execute('INSERT IGNORE INTO faculties (name) VALUES (?)', [name]);
    req.flash(result.affectedRows ? 'success' : 'info', result.affectedRows ? `Faculty “${name}” added.` : 'That faculty already exists.');
  } catch (err) {
    console.error('Faculty creation error:', err);
    req.flash('error', 'Could not add faculty. Apply the latest database schema and try again.');
  }
  res.redirect('/admin/settings');
});

router.post('/settings/faculties/:id/update', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 120) {
    req.flash('error', 'Enter a faculty name up to 120 characters.');
    return res.redirect('/admin/settings');
  }
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[faculty]] = await connection.execute('SELECT name FROM faculties WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!faculty) {
        await connection.rollback();
        req.flash('error', 'Faculty not found.');
      } else {
        await connection.execute('UPDATE faculties SET name = ? WHERE id = ?', [name, req.params.id]);
        await connection.execute('UPDATE users SET faculty = ? WHERE faculty = ?', [name, faculty.name]);
        await connection.commit();
        req.flash('success', 'Faculty updated.');
      }
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally { connection.release(); }
  } catch (err) {
    console.error('Faculty update error:', err);
    req.flash('error', 'Could not update faculty. The name may already be in use.');
  }
  res.redirect('/admin/settings');
});

router.post('/settings/faculties/:id/delete', async (req, res) => {
  try {
    const [[usage]] = await pool.execute(
      `SELECT (SELECT COUNT(*) FROM departments WHERE faculty_id = ?) AS department_count,
              (SELECT COUNT(*) FROM users WHERE faculty = (SELECT name FROM faculties WHERE id = ?)) AS user_count`,
      [req.params.id, req.params.id]
    );
    if (usage.department_count || usage.user_count) {
      req.flash('error', 'This faculty is still assigned to departments or users. Reassign them before deleting it.');
    } else {
      const [result] = await pool.execute('DELETE FROM faculties WHERE id = ?', [req.params.id]);
      req.flash(result.affectedRows ? 'success' : 'error', result.affectedRows ? 'Faculty deleted.' : 'Faculty not found.');
    }
  } catch (err) {
    console.error('Faculty deletion error:', err);
    req.flash('error', 'Could not delete faculty.');
  }
  res.redirect('/admin/settings');
});

router.post('/settings/departments', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const facultyId = Number(req.body.faculty_id);
  if (!name || name.length > 120 || !Number.isInteger(facultyId) || facultyId < 1) {
    req.flash('error', 'Enter a department name and select its faculty.');
    return res.redirect('/admin/settings');
  }
  try {
    const [result] = await pool.execute('INSERT IGNORE INTO departments (name, faculty_id) VALUES (?, ?)', [name, facultyId]);
    req.flash(result.affectedRows ? 'success' : 'info', result.affectedRows ? `Department “${name}” added.` : 'That department already exists.');
  } catch (err) {
    console.error('Department creation error:', err);
    req.flash('error', 'Could not add department. Make sure the selected faculty exists.');
  }
  res.redirect('/admin/settings');
});

router.post('/settings/departments/:id/update', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const facultyId = Number(req.body.faculty_id);
  if (!name || name.length > 120 || !Number.isInteger(facultyId) || facultyId < 1) {
    req.flash('error', 'Enter a department name and select its faculty.');
    return res.redirect('/admin/settings');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[department]] = await connection.execute('SELECT name FROM departments WHERE id = ? FOR UPDATE', [req.params.id]);
    const [[faculty]] = await connection.execute('SELECT name FROM faculties WHERE id = ?', [facultyId]);
    if (!department || !faculty) {
      await connection.rollback();
      req.flash('error', 'Department or selected faculty was not found.');
      return res.redirect('/admin/settings');
    }
    await connection.execute('UPDATE departments SET name = ?, faculty_id = ? WHERE id = ?', [name, facultyId, req.params.id]);
    await connection.execute('UPDATE courses SET department = ? WHERE department = ?', [name, department.name]);
    await connection.execute('UPDATE users SET department = ?, faculty = ? WHERE department = ?', [name, faculty.name, department.name]);
    await connection.commit();
    req.flash('success', 'Department updated.');
  } catch (err) {
    await connection.rollback();
    console.error('Department update error:', err);
    req.flash('error', 'Could not update department. The name may already be in use.');
  } finally { connection.release(); }
  res.redirect('/admin/settings');
});

router.post('/settings/departments/:id/delete', async (req, res) => {
  try {
    const [[usage]] = await pool.execute(
      `SELECT d.name,
              (SELECT COUNT(*) FROM users u WHERE u.department = d.name) AS user_count,
              (SELECT COUNT(*) FROM courses c WHERE c.department = d.name) AS course_count
       FROM departments d WHERE d.id = ?`,
      [req.params.id]
    );
    if (!usage) {
      req.flash('error', 'Department not found.');
    } else if (usage.user_count || usage.course_count) {
      req.flash('error', 'This department is still assigned to users or courses. Reassign them before deleting it.');
    } else {
      await pool.execute('DELETE FROM departments WHERE id = ?', [req.params.id]);
      req.flash('success', 'Department deleted.');
    }
  } catch (err) {
    console.error('Department deletion error:', err);
    req.flash('error', 'Could not delete department.');
  }
  res.redirect('/admin/settings');
});

router.post('/settings/semester', async (req, res) => {
  const semester = String(req.body.semester || '').trim();
  if (!/^\d{4}\/\d{4}-[12]$/.test(semester)) {
    req.flash('error', 'Enter a semester in the format 2025/2026-1 or 2025/2026-2.');
    return res.redirect('/admin/settings');
  }
  try {
    await pool.execute(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('current_semester', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [semester]
    );
    req.flash('success', `Current semester changed to ${semester}.`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not update the current semester.');
  }
  res.redirect('/admin/settings');
});

router.post('/settings/semesters', async (req, res) => {
  const semester = String(req.body.semester || '').trim();
  const match = /^(\d{4})\/(\d{4})-([12])$/.exec(semester);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    req.flash('error', 'Enter a valid semester such as 2026/2027-1 or 2026/2027-2.');
    return res.redirect('/admin/settings');
  }

  try {
    const [result] = await pool.execute('INSERT IGNORE INTO semesters (semester) VALUES (?)', [semester]);
    if (req.body.make_active === 'on') {
      await pool.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('current_semester', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [semester]
      );
      req.flash('success', result.affectedRows ? `${semester} was added and made the active semester.` : `${semester} already existed and is now the active semester.`);
    } else {
      req.flash('success', result.affectedRows ? `${semester} was added to the semester options.` : `${semester} is already available.`);
    }
  } catch (err) {
    console.error('Semester creation error:', err);
    req.flash('error', 'Could not add the semester. Apply the latest database schema and try again.');
  }
  res.redirect('/admin/settings');
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const semester = req.query.semester || req.currentSemester;
    const [[{ total_students }]] = await pool.execute(`SELECT COUNT(*) AS total_students FROM users WHERE role='student'`);
    const [[{ total_lecturers }]] = await pool.execute(`SELECT COUNT(*) AS total_lecturers FROM users WHERE role='lecturer'`);
    const [[{ total_courses }]]   = await pool.execute(`SELECT COUNT(*) AS total_courses FROM courses`);
    const [[{ total_registrations }]] = await pool.execute(
      `SELECT COUNT(*) AS total_registrations FROM registrations WHERE semester=? AND status!='dropped'`, [semester]);
    const [[{ total_venues }]] = await pool.execute(`SELECT COUNT(*) AS total_venues FROM venues`);

    const enrollmentData = await engine.getEnrollmentReport(pool, semester);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard — UCRSystem',
      stats: { total_students, total_lecturers, total_courses, total_registrations, total_venues },
      enrollmentData: enrollmentData.slice(0, 5),
      semester,
      semesters: req.semesters,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load dashboard stats.');
    res.render('admin/dashboard', { title: 'Dashboard', stats: {}, enrollmentData: [], semester: req.currentSemester, semesters: req.semesters });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// COURSES CRUD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/courses', async (req, res) => {
  const [courses] = await pool.execute(
    `SELECT c.*,
       GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ', ') AS prereq_codes
     FROM courses c
     LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
     LEFT JOIN courses p ON p.id = cp.prerequisite_id
     GROUP BY c.id ORDER BY c.department, c.level, c.code`
  );
  const [allCourses] = await pool.execute('SELECT id, code, title FROM courses ORDER BY code');
  const [departments] = await pool.execute(
    `SELECT name AS department FROM departments
     UNION SELECT DISTINCT department FROM courses ORDER BY department`
  );
  res.render('admin/courses', {
    title: 'Manage Courses — UCRSystem',
    courses,
    allCourses,
    departments,
    editCourse: null,
  });
});

router.post('/courses/create', async (req, res) => {
  const { code, title, credit_units, department, level, description, prerequisite_ids } = req.body;
  try {
    const [result] = await pool.execute(
      `INSERT INTO courses (code, title, credit_units, department, level, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code.trim().toUpperCase(), title.trim(), parseInt(credit_units), department.trim(), parseInt(level), description?.trim() || '']
    );
    const newId = result.insertId;

    // Insert prerequisites
    if (prerequisite_ids) {
      const ids = Array.isArray(prerequisite_ids) ? prerequisite_ids : [prerequisite_ids];
      for (const pid of ids) {
        await pool.execute(
          `INSERT IGNORE INTO course_prerequisites (course_id, prerequisite_id) VALUES (?, ?)`,
          [newId, parseInt(pid)]
        );
      }
    }
    req.flash('success', `Course ${code} created successfully.`);
  } catch (err) {
    console.error(err);
    req.flash('error', `Could not create course: ${err.message}`);
  }
  res.redirect('/admin/courses');
});

router.get('/courses/:id/edit', async (req, res) => {
  const [courses] = await pool.execute(
    `SELECT c.*,
       GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ', ') AS prereq_codes
     FROM courses c
     LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
     LEFT JOIN courses p ON p.id = cp.prerequisite_id
     GROUP BY c.id ORDER BY c.department, c.level, c.code`
  );
  const [editRows] = await pool.execute('SELECT * FROM courses WHERE id = ? LIMIT 1', [req.params.id]);
  const [editPrereqs] = await pool.execute(
    'SELECT prerequisite_id FROM course_prerequisites WHERE course_id = ?', [req.params.id]
  );
  const [allCourses] = await pool.execute('SELECT id, code, title FROM courses ORDER BY code');
  const [departments] = await pool.execute(
    `SELECT name AS department FROM departments
     UNION SELECT DISTINCT department FROM courses ORDER BY department`
  );
  const editCourse = editRows[0] || null;
  if (editCourse) {
    editCourse.prereq_ids = editPrereqs.map(r => r.prerequisite_id);
  }
  res.render('admin/courses', {
    title: 'Edit Course — UCRSystem',
    courses, allCourses, departments, editCourse,
  });
});

router.post('/courses/:id/update', async (req, res) => {
  const { code, title, credit_units, department, level, description, prerequisite_ids } = req.body;
  const { id } = req.params;
  try {
    await pool.execute(
      `UPDATE courses SET code=?, title=?, credit_units=?, department=?, level=?, description=? WHERE id=?`,
      [code.trim().toUpperCase(), title.trim(), parseInt(credit_units), department.trim(), parseInt(level), description?.trim() || '', id]
    );
    await pool.execute('DELETE FROM course_prerequisites WHERE course_id = ?', [id]);
    if (prerequisite_ids) {
      const ids = Array.isArray(prerequisite_ids) ? prerequisite_ids : [prerequisite_ids];
      for (const pid of ids) {
        await pool.execute(
          `INSERT IGNORE INTO course_prerequisites (course_id, prerequisite_id) VALUES (?, ?)`,
          [id, parseInt(pid)]
        );
      }
    }
    req.flash('success', `Course updated successfully.`);
  } catch (err) {
    console.error(err);
    req.flash('error', `Could not update: ${err.message}`);
  }
  res.redirect('/admin/courses');
});

router.post('/courses/:id/delete', async (req, res) => {
  try {
    await pool.execute('DELETE FROM courses WHERE id = ?', [req.params.id]);
    req.flash('success', 'Course deleted.');
  } catch (err) {
    req.flash('error', `Could not delete: ${err.message}`);
  }
  res.redirect('/admin/courses');
});

// ══════════════════════════════════════════════════════════════════════════════
// COURSE LECTURER ASSIGNMENTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/assignments', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  try {
    const [assignments] = await pool.execute(
      `SELECT cl.id, cl.semester, c.id AS course_id, c.code, c.title, c.department,
              u.id AS lecturer_id, u.name AS lecturer_name, u.staff_id
       FROM course_lecturers cl
       JOIN courses c ON c.id = cl.course_id
       JOIN users u ON u.id = cl.lecturer_id
       WHERE cl.semester = ?
       ORDER BY c.department, c.code`,
      [semester]
    );
    const [courses] = await pool.execute('SELECT id, code, title, department FROM courses ORDER BY department, code');
    const [lecturers] = await pool.execute("SELECT id, name, staff_id, department FROM users WHERE role='lecturer' ORDER BY department, name");
    res.render('admin/assignments', {
      title: 'Course Lecturer Assignments — UCRSystem', assignments, courses, lecturers, semester,
      selectedCourseId: req.query.course_id || '',
      semesters: req.semesters,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load course lecturer assignments. Apply the latest database schema and try again.');
    res.redirect('/admin/dashboard');
  }
});

router.post('/assignments', async (req, res) => {
  const { course_id, lecturer_id } = req.body;
  const semester = (req.body.semester || req.currentSemester).trim();
  try {
    const [valid] = await pool.execute(
      `SELECT c.id AS course_id, u.id AS lecturer_id
       FROM courses c JOIN users u ON u.id = ? AND u.role = 'lecturer'
       WHERE c.id = ?`,
      [lecturer_id, course_id]
    );
    if (!valid.length) {
      req.flash('error', 'Choose a valid course and lecturer.');
      return res.redirect(`/admin/assignments?semester=${encodeURIComponent(semester)}`);
    }
    await pool.execute(
      `INSERT INTO course_lecturers (course_id, lecturer_id, semester) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE lecturer_id = VALUES(lecturer_id), assigned_at = CURRENT_TIMESTAMP`,
      [course_id, lecturer_id, semester]
    );
    req.flash('success', 'Lecturer assigned to course for this semester.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not assign lecturer to course.');
  }
  res.redirect(`/admin/assignments?semester=${encodeURIComponent(semester)}`);
});

router.post('/assignments/:id/delete', async (req, res) => {
  const semester = (req.body.semester || req.currentSemester).trim();
  try {
    await pool.execute('DELETE FROM course_lecturers WHERE id = ?', [req.params.id]);
    req.flash('success', 'Course lecturer assignment removed.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not remove course lecturer assignment.');
  }
  res.redirect(`/admin/assignments?semester=${encodeURIComponent(semester)}`);
});

// ══════════════════════════════════════════════════════════════════════════════
// VENUES CRUD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/venues', async (req, res) => {
  const [venues] = await pool.execute('SELECT * FROM venues ORDER BY name');
  res.render('admin/venues', { title: 'Manage Venues — UCRSystem', venues, editVenue: null });
});

router.post('/venues/create', async (req, res) => {
  const { name, capacity, building } = req.body;
  try {
    await pool.execute(
      'INSERT INTO venues (name, capacity, building) VALUES (?, ?, ?)',
      [name.trim(), parseInt(capacity), building?.trim() || '']
    );
    req.flash('success', `Venue "${name}" created.`);
  } catch (err) {
    req.flash('error', `Could not create venue: ${err.message}`);
  }
  res.redirect('/admin/venues');
});

router.get('/venues/:id/edit', async (req, res) => {
  const [venues]   = await pool.execute('SELECT * FROM venues ORDER BY name');
  const [editRows] = await pool.execute('SELECT * FROM venues WHERE id=? LIMIT 1', [req.params.id]);
  res.render('admin/venues', { title: 'Edit Venue — UCRSystem', venues, editVenue: editRows[0] || null });
});

router.post('/venues/:id/update', async (req, res) => {
  const { name, capacity, building } = req.body;
  try {
    await pool.execute('UPDATE venues SET name=?, capacity=?, building=? WHERE id=?',
      [name.trim(), parseInt(capacity), building?.trim() || '', req.params.id]);
    req.flash('success', 'Venue updated.');
  } catch (err) {
    req.flash('error', `Could not update: ${err.message}`);
  }
  res.redirect('/admin/venues');
});

router.post('/venues/:id/delete', async (req, res) => {
  try {
    await pool.execute('DELETE FROM venues WHERE id=?', [req.params.id]);
    req.flash('success', 'Venue deleted.');
  } catch (err) {
    req.flash('error', `Could not delete: ${err.message}`);
  }
  res.redirect('/admin/venues');
});

// ══════════════════════════════════════════════════════════════════════════════
// TIMETABLE / COURSE ASSIGNMENTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/timetable', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  const [entries] = await pool.execute(
    `SELECT t.id, t.semester, t.day, t.start_time, t.end_time,
       c.code, c.title, c.credit_units,
       u.name AS lecturer_name, v.name AS venue_name, v.capacity
     FROM timetable t
     JOIN courses c ON c.id = t.course_id
     JOIN users   u ON u.id = t.lecturer_id
     JOIN venues  v ON v.id = t.venue_id
     WHERE t.semester = ?
     ORDER BY FIELD(t.day,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), t.start_time`,
    [semester]
  );
  const [courses]   = await pool.execute('SELECT id, code, title FROM courses ORDER BY code');
  const [lecturers] = await pool.execute(`SELECT id, name, staff_id FROM users WHERE role='lecturer' ORDER BY name`);
  const [venues]    = await pool.execute('SELECT * FROM venues ORDER BY name');

  res.render('admin/timetable', {
    title: 'Timetable Management — UCRSystem',
    entries, courses, lecturers, venues, semester, semesters: req.semesters,
    editEntry: null,
  });
});

router.post('/timetable/create', async (req, res) => {
  const { course_id, lecturer_id, venue_id, semester, day, start_time, end_time } = req.body;
  try {
    await pool.execute(
      `INSERT INTO timetable (course_id, lecturer_id, venue_id, semester, day, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parseInt(course_id), parseInt(lecturer_id), parseInt(venue_id),
       semester.trim(), day, start_time, end_time]
    );
    await pool.execute(
      `INSERT INTO course_lecturers (course_id, lecturer_id, semester) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE lecturer_id = VALUES(lecturer_id), assigned_at = CURRENT_TIMESTAMP`,
      [parseInt(course_id), parseInt(lecturer_id), semester.trim()]
    );
    req.flash('success', 'Timetable entry created.');
  } catch (err) {
    req.flash('error', `Could not create entry: ${err.message}`);
  }
  res.redirect(`/admin/timetable?semester=${encodeURIComponent(semester || req.currentSemester)}`);
});

router.post('/timetable/:id/delete', async (req, res) => {
  try {
    await pool.execute('DELETE FROM timetable WHERE id=?', [req.params.id]);
    req.flash('success', 'Timetable entry deleted.');
  } catch (err) {
    req.flash('error', `Could not delete: ${err.message}`);
  }
  res.redirect('/admin/timetable');
});

// ══════════════════════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  const role = String(req.query.role || '');
  const department = String(req.query.department || '');
  const level = String(req.query.level || '');
  const faculty = String(req.query.faculty || '');
  let sql = 'SELECT id, name, email, role, faculty, department, level, matric_no, staff_id, created_at, profile_photo_type FROM users WHERE 1=1';
  const params = [];
  if (['student', 'lecturer', 'admin'].includes(role)) { sql += ' AND role=?'; params.push(role); }
  if (faculty) { sql += ' AND faculty=?'; params.push(faculty); }
  if (department) { sql += ' AND department=?'; params.push(department); }
  if (/^(100|200|300|400)$/.test(level)) { sql += ' AND level=?'; params.push(Number(level)); }
  sql += ' ORDER BY role, name';
  const [users] = await pool.execute(sql, params);
  const [faculties] = await pool.execute('SELECT name AS faculty FROM faculties ORDER BY name');
  const [departments] = await pool.execute(
    `SELECT name AS department FROM departments
     UNION SELECT DISTINCT department FROM users WHERE department <> '' ORDER BY department`
  );
  const [levels] = await pool.execute('SELECT DISTINCT level FROM users WHERE level IS NOT NULL ORDER BY level');
  res.render('admin/users', {
    title: 'User Management — UCRSystem', users,
    filterRole: role, filterFaculty: faculty, filterDepartment: department, filterLevel: level,
    faculties, departments, levels,
  });
});

router.get('/password-resets', async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT pr.id, pr.created_at, u.name, u.email, u.role
       FROM password_reset_requests pr JOIN users u ON u.id = pr.user_id
       WHERE pr.status = 'pending' ORDER BY pr.created_at ASC`
    );
    res.render('admin/password-resets', { title: 'Password Reset Requests — UCRSystem', requests });
  } catch (err) {
    console.error('Password reset queue error:', err);
    req.flash('error', 'Could not load password reset requests. Apply the latest database schema and try again.');
    res.redirect('/admin/users');
  }
});

router.post('/password-resets/:id', async (req, res) => {
  const { temporary_password, confirm_password } = req.body;
  if (!temporary_password || temporary_password.length < 8 || temporary_password !== confirm_password) {
    req.flash('error', 'Enter matching temporary passwords with at least 8 characters.');
    return res.redirect('/admin/password-resets');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[request]] = await connection.execute(
      "SELECT user_id FROM password_reset_requests WHERE id = ? AND status = 'pending' FOR UPDATE",
      [req.params.id]
    );
    if (!request) {
      await connection.rollback();
      req.flash('error', 'That password reset request is no longer pending.');
      return res.redirect('/admin/password-resets');
    }
    const passwordHash = await bcrypt.hash(temporary_password, 12);
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, request.user_id]);
    await connection.execute(
      "UPDATE password_reset_requests SET status = 'resolved', resolved_at = NOW(), resolved_by = ? WHERE id = ?",
      [req.session.userId, req.params.id]
    );
    await connection.commit();
    req.flash('success', 'Temporary password set. Share it with the user through a trusted channel, then ask them to change it in Account Settings.');
  } catch (err) {
    await connection.rollback();
    console.error('Password reset completion error:', err);
    req.flash('error', 'Could not reset the password. Please try again.');
  } finally {
    connection.release();
  }
  res.redirect('/admin/password-resets');
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/reports', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  const type = req.query.type || 'enrollment';

  let data = [];
  if (type === 'enrollment') {
    data = await engine.getEnrollmentReport(pool, semester);
  } else if (type === 'venue') {
    data = await engine.getVenueUtilizationReport(pool, semester);
  } else if (type === 'credit') {
    data = await engine.getCreditLoadReport(pool, semester);
  }

  res.render('admin/reports', {
    title: 'Reports — UCRSystem',
    data, type, semester, semesters: req.semesters,
  });
});

// CSV export
router.get('/reports/export', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  const type = req.query.type || 'enrollment';

  let data = [];
  if (type === 'enrollment') {
    data = await engine.getEnrollmentReport(pool, semester);
  } else if (type === 'venue') {
    data = await engine.getVenueUtilizationReport(pool, semester);
  } else if (type === 'credit') {
    data = await engine.getCreditLoadReport(pool, semester);
  }

  if (data.length === 0) {
    req.flash('info', 'No data to export.');
    return res.redirect(`/admin/reports?type=${type}&semester=${encodeURIComponent(semester)}`);
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${semester.replace(/\//g, '-')}.csv"`);
  res.send(csvRows.join('\n'));
});

module.exports = router;
