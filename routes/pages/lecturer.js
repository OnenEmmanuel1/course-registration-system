'use strict';
const express = require('express');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireRole, noCache } = require('../../middleware/auth');

const router = express.Router();

router.use(requireRole('lecturer'), noCache, async (req, res, next) => {
  try {
    req.currentSemester = await engine.getCurrentSemester(pool);
    req.semesters = await engine.getAvailableSemesters(pool, req.currentSemester);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  try {
    const schedule = await engine.getLecturerSchedule(pool, req.session.userId, semester);
    res.render('lecturer/dashboard', {
      title: 'Lecturer Dashboard — UCRSystem',
      schedule,
      semester,
      semesters: req.semesters,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load dashboard.');
    res.render('lecturer/dashboard', { title: 'Dashboard', schedule: [], semester, semesters: req.semesters });
  }
});

// ── Teaching Schedule ─────────────────────────────────────────────────────────
router.get('/schedule', async (req, res) => {
  try {
    const semester = req.query.semester || req.currentSemester;
    const schedule = await engine.getLecturerSchedule(pool, req.session.userId, semester);
    res.render('lecturer/schedule', {
      title: 'My Teaching Schedule — UCRSystem',
      schedule,
      semester,
      semesters: req.semesters,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load schedule.');
    res.redirect('/lecturer/dashboard');
  }
});

// ── Course Detail (enrolled students) ─────────────────────────────────────────
router.get('/course/:courseId/students', async (req, res) => {
  try {
    const { courseId } = req.params;
    const semester = req.query.semester || req.currentSemester;

    // Verify this lecturer teaches this course
    const [ttRows] = await pool.execute(
      `SELECT t.id FROM timetable t
       WHERE t.lecturer_id = ? AND t.course_id = ? AND t.semester = ? LIMIT 1`,
      [req.session.userId, courseId, semester]
    );
    if (ttRows.length === 0) {
      req.flash('error', 'You are not assigned to this course.');
      return res.redirect('/lecturer/schedule');
    }

    const [course] = await pool.execute('SELECT * FROM courses WHERE id = ? LIMIT 1', [courseId]);
    const [students] = await pool.execute(
      `SELECT u.name, u.matric_no, u.department, u.level, r.registered_at, r.status
       FROM registrations r
       JOIN users u ON u.id = r.student_id
       WHERE r.course_id = ? AND r.semester = ? AND r.status != 'dropped'
       ORDER BY u.name`,
      [courseId, semester]
    );

    res.render('lecturer/students', {
      title: `Enrolled Students — ${course[0]?.code || ''}`,
      course: course[0] || {},
      students,
      semester,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load student list.');
    res.redirect('/lecturer/schedule');
  }
});

module.exports = router;
