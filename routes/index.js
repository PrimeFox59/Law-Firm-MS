const express = require('express');
const router = express.Router();

// Index - redirect to login
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.redirect('/auth/login');
});

module.exports = router;
