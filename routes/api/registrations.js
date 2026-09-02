'use strict';
/**
 * JSON API — Registration endpoints
 * POST /api/registrations/validate  — per-course validation
 * POST /api/registrations/submit    — bulk submit with per-course results
 * GET  /api/registrations/mine      — student's own registrations
 * DELETE /api/registrations/:id     — drop a course
 */
const express = require('express');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
const SEMESTER = process.env.CURRENT_SEMESTER || '2024/2025-1';

// POST /api/registrations/validate — validate a single course for logged-in student
router.post('/validate', requireRole('student'), async (req, res) => {
  const { courseId, semester } = req.body;
  if (!courseId) return res.status(400).json({ ok: false, error: 'courseId is required.' });
  try {
    const result = await engine.validateCourseSelection(
      pool, req.session.userId, parseInt(courseId), semester || SEMESTER
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/registrations/submit — submit course registrations for student
router.post('/submit', requireRole('student'), async (req, res) => {
  let { courseIds, semester } = req.body;
  if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'courseIds array is required.' });
  }
  try {
    const result = await engine.registerCourses(
      pool, req.session.userId, courseIds.map(Number), semester || SEMESTER
    );
    res.json({ ok: true, results: result.results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/registrations/mine — current student's registrations
router.get('/mine', requireRole('student'), async (req, res) => {
  const semester = req.query.semester || SEMESTER;
  try {
    const schedule = await engine.getStudentSchedule(pool, req.session.userId, semester);
    res.json({ ok: true, data: schedule });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/registrations/:courseId — drop a course
router.delete('/:courseId', requireRole('student'), async (req, res) => {
  const semester = req.query.semester || SEMESTER;
  try {
    await pool.execute(
      `UPDATE registrations SET status='dropped'
       WHERE student_id=? AND course_id=? AND semester=?`,
      [req.session.userId, req.params.courseId, semester]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
