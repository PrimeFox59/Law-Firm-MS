const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ActivityLog } = require('../models');
const googleEnabled = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackPath = process.env.GOOGLE_CALLBACK_URL ? new URL(process.env.GOOGLE_CALLBACK_URL).pathname : '/auth/google/callback';
// Router is mounted at /auth, so avoid double prefixing /auth
const googleCallbackRoute = googleCallbackPath.startsWith('/auth')
  ? googleCallbackPath.replace(/^\/auth/, '')
  : googleCallbackPath;

// Login Page
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { 
    title: 'Login',
    error: req.flash('error'),
    success: req.flash('success')
  });
});

// Login POST with remember-me support
router.post('/login', (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info?.message || 'Invalid credentials');
      return res.redirect('/auth/login');
    }

    req.logIn(user, async (err) => {
      if (err) return next(err);

      // Remember-me: extend cookie; otherwise, session cookie only
      if (req.body.remember) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
      } else {
        req.session.cookie.expires = false; // browser session
      }

      try {
        await ActivityLog.create({
          user_id: req.user.id,
          action: 'Login',
          module: 'Authentication',
          details: 'User logged in via email/password',
          ip_address: req.ip
        });
      } catch (e) {
        console.error('Failed to log activity', e);
      }

      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!googleEnabled) {
    req.flash('error', 'Google login is not configured.');
    return res.redirect('/auth/login');
  }
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar'],
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true
  })(req, res, next);
});

router.get(googleCallbackRoute, (req, res, next) => {
  if (!googleEnabled) {
    req.flash('error', 'Google login is not configured.');
    return res.redirect('/auth/login');
  }
  passport.authenticate('google', { 
    failureRedirect: '/auth/login',
    failureFlash: true
  })(req, res, async () => {
    if (!req.user) {
      req.flash('error', 'Login session not found. Please try again.');
      return res.redirect('/auth/login');
    }

    try {
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'Login',
        module: 'Authentication',
        details: 'User logged in via Google OAuth',
        ip_address: req.ip
      });
    } catch (e) {
      console.error('Failed to log Google login activity', e);
    }

    res.redirect('/dashboard');
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
    }
    req.flash('success', 'You have been logged out successfully');
    res.redirect('/auth/login');
  });
});

module.exports = router;
