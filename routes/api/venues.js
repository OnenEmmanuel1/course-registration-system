'use strict';
const express = require('express');
const pool    = require('../../config/db');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

// GET /api/venues
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM venues ORDER BY name');
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/venues
router.post('/', requireRole('admin'), async (req, res) => {
  const { name, capacity, building } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO venues (name, capacity, building) VALUES (?,?,?)',
      [name.trim(), parseInt(capacity), building?.trim() || '']
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// PUT /api/venues/:id
router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, capacity, building } = req.body;
  try {
    await pool.execute('UPDATE venues SET name=?,capacity=?,building=? WHERE id=?',
      [name.trim(), parseInt(capacity), building?.trim() || '', req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DELETE /api/venues/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await pool.execute('DELETE FROM venues WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
