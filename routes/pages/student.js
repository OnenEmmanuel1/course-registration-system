'use strict';
const express = require('express');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireRole, noCache } = require('../../middleware/auth');

const router = express.Router();
const SEMESTER = process.env.CURRENT_SEMESTER || '2024/2025-1';

// All student routes require 'student' role
router.use(requireRole('student'), noCache);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const schedule = await engine.getStudentSchedule(pool, req.session.userId, SEMESTER);
    const policy   = await engine.getCreditPolicy(pool);

    // Sum current credits
    const totalCredits = schedule.reduce((sum, r) => sum + (r.credit_units || 0), 0);

    res.render('student/dashboard', {
      title: 'Student Dashboard — UCRSystem',
      schedule,
      totalCredits,
      policy,
      semester: SEMESTER,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load dashboard data.');
    res.render('student/dashboard', { title: 'Dashboard', schedule: [], totalCredits: 0, policy: {min:12,max:24}, semester: SEMESTER });
  }
});

// ── Course Catalog ────────────────────────────────────────────────────────────
router.get('/catalog', async (req, res) => {
  try {
    const { dept, level, search } = req.query;
    let sql = `
      SELECT c.*,
        GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ', ') AS prereq_codes,
        t.day, t.start_time, t.end_time,
        v.name AS venue_name,
        u.name AS lecturer_name
      FROM courses c
      LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
      LEFT JOIN courses p ON p.id = cp.prerequisite_id
      LEFT JOIN timetable t ON t.course_id = c.id AND t.semester = ?
      LEFT JOIN venues v ON v.id = t.venue_id
      LEFT JOIN users  u ON u.id = t.lecturer_id
      WHERE 1=1`;
    const params = [SEMESTER];

    if (dept)   { sql += ' AND c.department = ?'; params.push(dept); }
    if (level)  { sql += ' AND c.level = ?';      params.push(parseInt(level)); }
    if (search) { sql += ' AND (c.code LIKE ? OR c.title LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    sql += ' GROUP BY c.id, t.id ORDER BY c.department, c.level, c.code';

    const [courses] = await pool.execute(sql, params);

    // Get distinct departments and levels for filters
    const [depts]  = await pool.execute('SELECT DISTINCT department FROM courses ORDER BY department');
    const [levels] = await pool.execute('SELECT DISTINCT level FROM courses ORDER BY level');

    // Get already-registered course IDs for this student in current semester
    const [regRows] = await pool.execute(
      `SELECT course_id FROM registrations WHERE student_id = ? AND semester = ? AND status != 'dropped'`,
      [req.session.userId, SEMESTER]
    );
    const registeredIds = new Set(regRows.map(r => r.course_id));

    res.render('student/catalog', {
      title: 'Course Catalog — UCRSystem',
      courses,
      depts,
      levels,
      registeredIds,
      filters: { dept: dept || '', level: level || '', search: search || '' },
      semester: SEMESTER,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load course catalog.');
    res.redirect('/student/dashboard');
  }
});

// ── Registration Page ─────────────────────────────────────────────────────────
router.get('/register', async (req, res) => {
  try {
    const [courses] = await pool.execute(
      `SELECT c.id, c.code, c.title, c.credit_units, c.department, c.level,
              GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ', ') AS prereq_codes
       FROM courses c
       LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
       LEFT JOIN courses p ON p.id = cp.prerequisite_id
       GROUP BY c.id
       ORDER BY c.department, c.level, c.code`
    );

    const [regRows] = await pool.execute(
      `SELECT course_id FROM registrations WHERE student_id = ? AND semester = ? AND status != 'dropped'`,
      [req.session.userId, SEMESTER]
    );
    const registeredIds = new Set(regRows.map(r => r.course_id));

    const policy = await engine.getCreditPolicy(pool);

    // Current credit load
    const [creditRow] = await pool.execute(
      `SELECT COALESCE(SUM(c.credit_units),0) AS total
       FROM registrations r JOIN courses c ON c.id=r.course_id
       WHERE r.student_id=? AND r.semester=? AND r.status!='dropped'`,
      [req.session.userId, SEMESTER]
    );
    const currentCredits = parseInt(creditRow[0].total || 0);

    res.render('student/register', {
      title: 'Course Registration — UCRSystem',
      courses,
      registeredIds,
      policy,
      currentCredits,
      semester: SEMESTER,
      results: null,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load registration page.');
    res.redirect('/student/dashboard');
  }
});

// POST /student/register — submit course selections
router.post('/register', async (req, res) => {
  try {
    let courseIds = req.body.courseIds;
    if (!courseIds) {
      req.flash('error', 'Please select at least one course to register.');
      return res.redirect('/student/register');
    }

    // Normalize to array
    if (!Array.isArray(courseIds)) courseIds = [courseIds];
    courseIds = courseIds.map(id => parseInt(id)).filter(id => !isNaN(id));

    if (courseIds.length === 0) {
      req.flash('error', 'No valid courses selected.');
      return res.redirect('/student/register');
    }

    const { results } = await engine.registerCourses(pool, req.session.userId, courseIds, SEMESTER);

    // Re-fetch data for re-render
    const [courses] = await pool.execute(
      `SELECT c.id, c.code, c.title, c.credit_units, c.department, c.level,
              GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ', ') AS prereq_codes
       FROM courses c
       LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
       LEFT JOIN courses p ON p.id = cp.prerequisite_id
       GROUP BY c.id
       ORDER BY c.department, c.level, c.code`
    );
    const [regRows] = await pool.execute(
      `SELECT course_id FROM registrations WHERE student_id = ? AND semester = ? AND status != 'dropped'`,
      [req.session.userId, SEMESTER]
    );
    const registeredIds = new Set(regRows.map(r => r.course_id));
    const policy = await engine.getCreditPolicy(pool);
    const [creditRow] = await pool.execute(
      `SELECT COALESCE(SUM(c.credit_units),0) AS total
       FROM registrations r JOIN courses c ON c.id=r.course_id
       WHERE r.student_id=? AND r.semester=? AND r.status!='dropped'`,
      [req.session.userId, SEMESTER]
    );
    const currentCredits = parseInt(creditRow[0].total || 0);

    res.render('student/register', {
      title: 'Course Registration — UCRSystem',
      courses,
      registeredIds,
      policy,
      currentCredits,
      semester: SEMESTER,
      results,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Registration failed due to a server error.');
    res.redirect('/student/register');
  }
});

// ── Schedule ──────────────────────────────────────────────────────────────────
router.get('/schedule', async (req, res) => {
  try {
    const semester = req.query.semester || SEMESTER;
    const schedule = await engine.getStudentSchedule(pool, req.session.userId, semester);
    const policy   = await engine.getCreditPolicy(pool);
    const totalCredits = schedule.reduce((sum, r) => sum + (r.credit_units || 0), 0);

    res.render('student/schedule', {
      title: 'My Schedule — UCRSystem',
      schedule,
      totalCredits,
      policy,
      semester,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load schedule.');
    res.redirect('/student/dashboard');
  }
});

module.exports = router;
