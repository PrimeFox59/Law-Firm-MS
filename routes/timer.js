const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { User } = require('../models');

const buildState = (user, serverNowMs) => {
  const running = !!user.timer_running;
  const startMs = user.timer_started_at ? new Date(user.timer_started_at).getTime() : null;
  let elapsedMs = Number(user.timer_elapsed_ms || 0);

  if (running && startMs) {
    elapsedMs += Math.max(0, serverNowMs - startMs);
  }

  return {
    state: {
      running,
      startedAt: startMs ? new Date(startMs).toISOString() : null,
      elapsedMs
    },
    serverNow: serverNowMs
  };
};

router.get('/state', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['timer_running', 'timer_started_at', 'timer_elapsed_ms']
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const serverNowMs = Date.now();
    const payload = buildState(user, serverNowMs);
    res.json({ success: true, ...payload });
  } catch (err) {
    console.error('Timer state error', err);
    res.status(500).json({ success: false, message: 'Failed to load timer state' });
  }
});

router.post('/start', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Only restart if not already running
    if (!user.timer_running) {
      const startedAt = new Date();
      await user.update({
        timer_running: true,
        timer_started_at: startedAt,
        timer_elapsed_ms: 0
      });
      user.timer_running = true;
      user.timer_started_at = startedAt;
      user.timer_elapsed_ms = 0;
    }

    const serverNowMs = Date.now();
    const payload = buildState(user, serverNowMs);
    res.json({ success: true, ...payload });
  } catch (err) {
    console.error('Timer start error', err);
    res.status(500).json({ success: false, message: 'Failed to start timer' });
  }
});

router.post('/stop', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const serverNowMs = Date.now();
    const startMs = user.timer_started_at ? new Date(user.timer_started_at).getTime() : null;
    let elapsedMs = Number(user.timer_elapsed_ms || 0);

    if (user.timer_running && startMs) {
      elapsedMs += Math.max(0, serverNowMs - startMs);
    }

    await user.update({
      timer_running: false,
      timer_started_at: null,
      timer_elapsed_ms: 0
    });

    user.timer_running = false;
    user.timer_started_at = null;
    user.timer_elapsed_ms = 0;

    const payload = buildState(user, serverNowMs);
    res.json({ success: true, elapsedMs, ...payload });
  } catch (err) {
    console.error('Timer stop error', err);
    res.status(500).json({ success: false, message: 'Failed to stop timer' });
  }
});

module.exports = router;
