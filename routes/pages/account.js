'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../../config/db');
const { requireAuth, noCache } = require('../../middleware/auth');

const router = express.Router();
const MAX_PROFILE_PHOTO_BYTES = 400 * 1024;

function photoUploadError(req, res, status, message) {
  req.flash('error', message);
  return res.status(status).json({ ok: false, flash: true });
}
router.use(requireAuth, noCache);

router.get('/', async (req, res) => {
  try {
    const [[account]] = await pool.execute(
      'SELECT name, email, role, profile_photo_type FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );
    if (!account) return res.redirect('/login');
    res.render('account/settings', { title: 'Account Settings — UCRSystem', account });
  } catch (err) {
    console.error('Account settings error:', err);
    req.flash('error', 'Could not load account settings.');
    res.redirect(`/${req.session.role}/dashboard`);
  }
});

router.post('/password', async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  if (!current_password || !new_password || !confirm_password) {
    req.flash('error', 'Complete all password fields.');
    return res.redirect('/account');
  }
  if (new_password.length < 8) {
    req.flash('error', 'Your new password must be at least 8 characters.');
    return res.redirect('/account');
  }
  if (new_password !== confirm_password) {
    req.flash('error', 'The new password and confirmation do not match.');
    return res.redirect('/account');
  }
  try {
    const [[user]] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.session.userId]);
    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
      req.flash('error', 'Your current password is incorrect.');
      return res.redirect('/account');
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.session.userId]);
    req.flash('success', 'Your password has been changed.');
  } catch (err) {
    console.error('Password change error:', err);
    req.flash('error', 'Could not change your password. Please try again.');
  }
  res.redirect('/account');
});

router.post('/photo', async (req, res) => {
  try {
    if (req.body.remove === true) {
      await pool.execute('UPDATE users SET profile_photo_data = NULL, profile_photo_type = NULL WHERE id = ?', [req.session.userId]);
      req.session.profilePhotoType = null;
      return res.json({ ok: true, removed: true });
    }

    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(req.body.dataUrl || '');
    if (!match) return photoUploadError(req, res, 400, 'Choose a JPEG, PNG, WebP, or GIF image.');
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > MAX_PROFILE_PHOTO_BYTES) {
      return photoUploadError(req, res, 400, 'Profile photos must be 400 KB or smaller. Please resize the image and try again.');
    }

    const signatures = {
      'image/jpeg': image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff,
      'image/png': image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/webp': image.length >= 12 && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP',
      'image/gif': image.length >= 6 && /^GIF8[79]a$/.test(image.toString('ascii', 0, 6)),
    };
    if (!signatures[match[1]]) return photoUploadError(req, res, 400, 'The selected file is not a valid image.');

    await pool.execute(
      'UPDATE users SET profile_photo_data = ?, profile_photo_type = ? WHERE id = ?',
      [match[2], match[1], req.session.userId]
    );
    req.session.profilePhotoType = match[1];
    res.json({ ok: true, photoUrl: `/account/photo/${req.session.userId}?v=${Date.now()}` });
  } catch (err) {
    console.error('Profile photo update error:', err);
    if (err.code === 'ER_NET_PACKET_TOO_LARGE' || err.errno === 1153) {
      return photoUploadError(req, res, 413, 'This image is too large for the database. Choose a smaller image (400 KB or less).');
    }
    return photoUploadError(req, res, 500, 'Could not save your profile photo. Please try again.');
  }
});

router.get('/photo/:id', async (req, res) => {
  try {
    const [[photo]] = await pool.execute(
      'SELECT profile_photo_data, profile_photo_type FROM users WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!photo?.profile_photo_data || !photo.profile_photo_type) return res.sendStatus(404);
    res.set('Content-Type', photo.profile_photo_type);
    res.set('Cache-Control', 'private, no-cache, must-revalidate');
    res.send(Buffer.from(photo.profile_photo_data, 'base64'));
  } catch (err) {
    console.error('Profile photo retrieval error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
