'use strict';
/**
 * UCRSystem — Main Application Entry Point
 * UNICROSS University Course Registration System
 */

require('dotenv').config();

const express       = require('express');
const session       = require('express-session');
const flash         = require('connect-flash');
const methodOverride = require('method-override');
const path          = require('path');

const { injectUser, noCache } = require('./middleware/auth');

// Page Routes
const authRoutes     = require('./routes/pages/auth');
const studentRoutes  = require('./routes/pages/student');
const lecturerRoutes = require('./routes/pages/lecturer');
const adminRoutes    = require('./routes/pages/admin');

// API Routes
const apiCourses       = require('./routes/api/courses');
const apiRegistrations = require('./routes/api/registrations');
const apiVenues        = require('./routes/api/venues');
const apiReports       = require('./routes/api/reports');

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// ── View Engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ucrs_fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    sameSite: 'lax',
  },
  name: 'ucrs.sid',
}));

app.use(flash());
app.use(injectUser);

// ── Page Routes ───────────────────────────────────────────────────────────────
app.use('/', authRoutes);
app.use('/student',  studentRoutes);
app.use('/lecturer', lecturerRoutes);
app.use('/admin',    adminRoutes);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/courses',       apiCourses);
app.use('/api/registrations', apiRegistrations);
app.use('/api/venues',        apiVenues);
app.use('/api/reports',       apiReports);

// ── Root Redirect ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(`/${req.session.role}/dashboard`);
  }
  res.redirect('/login');
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Page Not Found — UCRSystem',
    user: req.session.userId ? req.session : null,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('errors/500', {
    title: 'Server Error — UCRSystem',
    user: req.session.userId ? req.session : null,
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  UCRSystem running at http://localhost:${PORT}`);
  console.log(`    Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`    Current Semester: ${process.env.CURRENT_SEMESTER || '2024/2025-1'}`);
});

module.exports = app;
