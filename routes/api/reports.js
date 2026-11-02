'use strict';
const express = require('express');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireRole('admin'), async (req, res, next) => {
  try {
    req.currentSemester = await engine.getCurrentSemester(pool);
    next();
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/enrollment
router.get('/enrollment', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  try {
    const data = await engine.getEnrollmentReport(pool, semester);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/reports/venue
router.get('/venue', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  try {
    const data = await engine.getVenueUtilizationReport(pool, semester);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/reports/credit
router.get('/credit', async (req, res) => {
  const semester = req.query.semester || req.currentSemester;
  try {
    const data = await engine.getCreditLoadReport(pool, semester);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
