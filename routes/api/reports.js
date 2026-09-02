'use strict';
const express = require('express');
const pool    = require('../../config/db');
const engine  = require('../../engine/ucrsEngine');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();
const SEMESTER = process.env.CURRENT_SEMESTER || '2024/2025-1';

// GET /api/reports/enrollment
router.get('/enrollment', requireRole('admin'), async (req, res) => {
  const semester = req.query.semester || SEMESTER;
  try {
    const data = await engine.getEnrollmentReport(pool, semester);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/reports/venue
router.get('/venue', requireRole('admin'), async (req, res) => {
  const semester = req.query.semester || SEMESTER;
  try {
    const data = await engine.getVenueUtilizationReport(pool, semester);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/reports/credit
router.get('/credit', requireRole('admin'), async (req, res) => {
  const semester = req.query.semester || SEMESTER;
  try {
    const data = await engine.getCreditLoadReport(pool, semester);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
