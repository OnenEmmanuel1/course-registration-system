'use strict';
/**
 * Authentication & Role-Based Access Control Middleware
 */

/**
 * requireAuth — ensures a user is logged in.
 * Redirects to /login with a flash message on failure.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ ok: false, error: 'Authentication required. Please log in.' });
  }
  req.flash('error', 'Please log in to access that page.');
  return res.redirect('/login');
}

/**
 * requireRole — ensures the logged-in user has one of the allowed roles.
 * @param {...string} roles - allowed role strings
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ ok: false, error: 'Authentication required. Please log in.' });
      }
      req.flash('error', 'Please log in to access that page.');
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.role)) {
      if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ ok: false, error: `Forbidden: Access restricted to ${roles.join(', ')}.` });
      }
      return res.status(403).render('errors/403', {
        title: 'Access Denied',
        user: req.session,
        message: `This area is restricted to: ${roles.join(', ')}.`,
      });
    }
    return next();
  };
}

/**
 * injectUser — attaches session user data to res.locals for use in all EJS templates.
 */
function injectUser(req, res, next) {
  res.locals.user = req.session.userId
    ? {
        id: req.session.userId,
        name: req.session.name,
        email: req.session.email,
        role: req.session.role,
        department: req.session.department,
        level: req.session.level,
        matricNo: req.session.matricNo,
        staffId: req.session.staffId,
        profilePhotoUrl: req.session.profilePhotoType ? `/account/photo/${req.session.userId}` : null,
      }
    : null;
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
    info: req.flash('info'),
  };
  next();
}

/**
 * noCache — prevents authenticated pages from being cached.
 */
function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}

module.exports = { requireAuth, requireRole, injectUser, noCache };
