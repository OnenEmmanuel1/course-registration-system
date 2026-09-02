'use strict';
const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../../config/db');
const { noCache } = require('../../middleware/auth');

const router = express.Router();

// GET /login
router.get('/login', noCache, (req, res) => {
  if (req.session.userId) {
    return res.redirect(`/${req.session.role}/dashboard`);
  }
  res.render('auth/login', {
    title: 'UCRSystem — Login',
    error: req.flash('error'),
    info:  req.flash('info'),
  });
});

// POST /login
router.post('/login', noCache, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Email and password are required.');
    return res.redirect('/login');
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, password_hash, role, department, level, matric_no, staff_id
       FROM users WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      req.flash('error', 'Invalid email or password. Please try again.');
      return res.redirect('/login');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      req.flash('error', 'Invalid email or password. Please try again.');
      return res.redirect('/login');
    }

    // Establish session
    req.session.regenerate((err) => {
      if (err) {
        req.flash('error', 'Session error. Please try again.');
        return res.redirect('/login');
      }
      req.session.userId     = user.id;
      req.session.name       = user.name;
      req.session.email      = user.email;
      req.session.role       = user.role;
      req.session.department = user.department;
      req.session.level      = user.level;
      req.session.matricNo   = user.matric_no;
      req.session.staffId    = user.staff_id;

      req.session.save((saveErr) => {
        if (saveErr) {
          req.flash('error', 'Could not save session.');
          return res.redirect('/login');
        }
        return res.redirect(`/${user.role}/dashboard`);
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'An unexpected error occurred. Please try again.');
    return res.redirect('/login');
  }
});

// POST /logout (or GET for simplicity)
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
