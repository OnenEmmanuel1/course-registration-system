'use strict';
/**
 * JSON API — Course endpoints
 * All routes prefixed: /api/courses
 */
const express = require('express');
const pool    = require('../../config/db');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

// GET /api/courses — list all courses
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.code, c.title, c.credit_units, c.department, c.level, c.description,
         GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ', ') AS prereq_codes,
         GROUP_CONCAT(DISTINCT cp.prerequisite_id ORDER BY cp.prerequisite_id SEPARATOR ',') AS prereq_ids
       FROM courses c
       LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
       LEFT JOIN courses p ON p.id = cp.prerequisite_id
       GROUP BY c.id ORDER BY c.department, c.level, c.code`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/courses/:id — single course with prerequisites
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, GROUP_CONCAT(DISTINCT p.code SEPARATOR ', ') AS prereq_codes
       FROM courses c
       LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
       LEFT JOIN courses p ON p.id = cp.prerequisite_id
       WHERE c.id = ? GROUP BY c.id`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Course not found.' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/courses — create (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  const { code, title, credit_units, department, level, description, prerequisite_ids } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO courses (code,title,credit_units,department,level,description) VALUES (?,?,?,?,?,?)',
      [code.trim().toUpperCase(), title.trim(), parseInt(credit_units), department.trim(), parseInt(level), description?.trim() || '']
    );
    const newId = result.insertId;
    if (prerequisite_ids && prerequisite_ids.length > 0) {
      const ids = Array.isArray(prerequisite_ids) ? prerequisite_ids : [prerequisite_ids];
      for (const pid of ids) {
        await pool.execute('INSERT IGNORE INTO course_prerequisites VALUES (?,?)', [newId, parseInt(pid)]);
      }
    }
    res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// PUT /api/courses/:id — update (admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  const { code, title, credit_units, department, level, description, prerequisite_ids } = req.body;
  const { id } = req.params;
  try {
    await pool.execute(
      'UPDATE courses SET code=?,title=?,credit_units=?,department=?,level=?,description=? WHERE id=?',
      [code.trim().toUpperCase(), title.trim(), parseInt(credit_units), department.trim(), parseInt(level), description?.trim() || '', id]
    );
    await pool.execute('DELETE FROM course_prerequisites WHERE course_id=?', [id]);
    if (prerequisite_ids && prerequisite_ids.length > 0) {
      const ids = Array.isArray(prerequisite_ids) ? prerequisite_ids : [prerequisite_ids];
      for (const pid of ids) {
        await pool.execute('INSERT IGNORE INTO course_prerequisites VALUES (?,?)', [id, parseInt(pid)]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DELETE /api/courses/:id (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await pool.execute('DELETE FROM courses WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
