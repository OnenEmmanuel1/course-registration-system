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
    // injectUser has already consumed queued messages into res.locals.flash.
    error: res.locals.flash.error,
    info:  res.locals.flash.info,
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
      `SELECT id, name, email, password_hash, role, department, level, matric_no, staff_id, profile_photo_type
       FROM users WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      req.flash('error', 'User not found. Please check the email address and try again.');
      return res.redirect('/login');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      req.flash('error', 'Wrong password. Please try again.');
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
      req.session.profilePhotoType = user.profile_photo_type;

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

router.get('/forgot-password', noCache, (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password — UCRSystem' });
});

router.post('/forgot-password', noCache, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    if (email) {
      const [[account]] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (account) {
        const [[pending]] = await pool.execute(
          "SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'pending' LIMIT 1",
          [account.id]
        );
        if (!pending) await pool.execute('INSERT INTO password_reset_requests (user_id) VALUES (?)', [account.id]);
      }
    }
    req.flash('info', 'If the account exists, a password reset request has been sent to the administrators. Contact your administrator to receive a temporary password.');
  } catch (err) {
    console.error('Password reset request error:', err);
    req.flash('error', 'Could not submit your request. Please contact an administrator.');
  }
  res.redirect('/forgot-password');
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
