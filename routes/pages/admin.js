'use strict';
const express = require('express');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireRole, noCache } = require('../../middleware/auth');

const router = express.Router();
const SEMESTER = process.env.CURRENT_SEMESTER || '2024/2025-1';

router.use(requireRole('admin'), noCache);

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const semester = req.query.semester || SEMESTER;
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
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load dashboard stats.');
    res.render('admin/dashboard', { title: 'Dashboard', stats: {}, enrollmentData: [], semester: SEMESTER });
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
  res.render('admin/courses', {
    title: 'Manage Courses — UCRSystem',
    courses,
    allCourses,
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
  const editCourse = editRows[0] || null;
  if (editCourse) {
    editCourse.prereq_ids = editPrereqs.map(r => r.prerequisite_id);
  }
  res.render('admin/courses', {
    title: 'Edit Course — UCRSystem',
    courses, allCourses, editCourse,
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
  const semester = req.query.semester || SEMESTER;
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
    entries, courses, lecturers, venues, semester,
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
    req.flash('success', 'Timetable entry created.');
  } catch (err) {
    req.flash('error', `Could not create entry: ${err.message}`);
  }
  res.redirect(`/admin/timetable?semester=${encodeURIComponent(semester || SEMESTER)}`);
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
  const { role } = req.query;
  let sql = 'SELECT id, name, email, role, department, level, matric_no, staff_id, created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role=?'; params.push(role); }
  sql += ' ORDER BY role, name';
  const [users] = await pool.execute(sql, params);
  res.render('admin/users', { title: 'User Management — UCRSystem', users, filterRole: role || '' });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/reports', async (req, res) => {
  const semester = req.query.semester || SEMESTER;
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
    data, type, semester,
  });
});

// CSV export
router.get('/reports/export', async (req, res) => {
  const semester = req.query.semester || SEMESTER;
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
