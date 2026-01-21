const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { User, ActivityLog, Hierarchy } = require('../models');
const { sendNotification, notifications } = require('../utils/whatsappNotifier');
const multer = require('multer');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Build a default role-based hierarchy from known account types
async function ensureDefaultHierarchy() {
  const existing = await Hierarchy.count();
  if (existing > 0) return null;

  const defaultTree = [
    { id: 'role-admin', title: 'Admin', children: [] },
    { id: 'role-attorney', title: 'Attorney', children: [
      { id: 'role-partner', title: 'Partner', children: [] },
      { id: 'role-associate', title: 'Associate', children: [] }
    ]},
    { id: 'role-staff', title: 'Staff', children: [] },
    { id: 'role-client', title: 'Client', children: [] }
  ];

  return Hierarchy.create({
    name: 'Role Hierarchy',
    data: JSON.stringify(defaultTree)
  });
}

// Settings main page
router.get('/', isAuthenticated, (req, res) => {
  res.render('settings/index', {
    title: 'Settings',
    user: req.user
  });
});

// Profile settings
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const activityLogs = await ActivityLog.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 20
    });

    res.render('settings/profile', {
      title: 'Profile Settings',
      activityLogs
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading profile');
    res.redirect('/settings');
  }
});

// Update profile
router.post('/profile', isAuthenticated, async (req, res) => {
  try {
    const { full_name, email, phone, company, hourly_rate, language, theme } = req.body;

    await req.user.update({
      full_name,
      email,
      phone,
      company,
      hourly_rate: hourly_rate || 0,
      language,
      theme
    });

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'Update Profile',
      module: 'Settings',
      details: 'Profile information updated',
      ip_address: req.ip
    });

    req.flash('success', 'Profile updated successfully');
    res.redirect('/settings/profile');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating profile');
    res.redirect('/settings/profile');
  }
});

// Upload avatar
router.post('/profile/avatar', isAuthenticated, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'No file uploaded');
      return res.redirect('/settings/profile');
    }

    await req.user.update({ avatar: '/uploads/avatars/' + req.file.filename });

    req.flash('success', 'Avatar updated successfully');
    res.redirect('/settings/profile');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error uploading avatar');
    res.redirect('/settings/profile');
  }
});

// Security settings
router.get('/security', isAuthenticated, (req, res) => {
  res.render('settings/security', {
    title: 'Security Settings'
  });
});

// Change password
router.post('/security/password', isAuthenticated, async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    // Validate current password
    if (req.user.password) {
      const isValid = await req.user.validatePassword(current_password);
      if (!isValid) {
        req.flash('error', 'Current password is incorrect');
        return res.redirect('/settings/security');
      }
    }

    // Validate new password
    if (new_password !== confirm_password) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/settings/security');
    }

    if (new_password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters');
      return res.redirect('/settings/security');
    }

    // Update password
    await req.user.update({ password: new_password });

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'Change Password',
      module: 'Security',
      details: 'Password changed successfully',
      ip_address: req.ip
    });

    req.flash('success', 'Password changed successfully');
    res.redirect('/settings/security');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error changing password');
    res.redirect('/settings/security');
  }
});

// Google Account settings
router.get('/google', isAuthenticated, (req, res) => {
  res.render('settings/google', {
    title: 'Google Account Settings'
  });
});

// Hierarchy management
router.get('/hierarchy', isAuthenticated, async (req, res) => {
  try {
    await ensureDefaultHierarchy();

    const hierarchies = await Hierarchy.findAll({ order: [['created_at', 'DESC']] });
    const selectedId = req.query.id || (hierarchies[0] ? hierarchies[0].id : null);
    let treeData = [];
    let selected = null;

    if (selectedId) {
      selected = await Hierarchy.findByPk(selectedId);
      if (selected && selected.data) {
        try {
          treeData = JSON.parse(selected.data);
        } catch (e) {
          treeData = [];
        }
      }
    }

    res.render('settings/hierarchy', {
      title: 'Hierarchy',
      hierarchies,
      selectedId,
      treeData
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading hierarchy');
    res.redirect('/settings');
  }
});

router.post('/hierarchy', isAuthenticated, async (req, res) => {
  try {
    const { name } = req.body;
    const defaultTree = [
      { id: 'dept-management', title: 'Management', children: [
        { id: 'role-partner', title: 'Partner', children: [] },
        { id: 'role-associate', title: 'Associate', children: [] }
      ]},
      { id: 'dept-support', title: 'Support', children: [
        { id: 'role-finance', title: 'Finance', children: [] },
        { id: 'role-hr', title: 'HR', children: [] }
      ]}
    ];

    const record = await Hierarchy.create({
      name: name || `Hierarchy ${new Date().toLocaleDateString()}`,
      data: JSON.stringify(defaultTree)
    });

    res.redirect(`/settings/hierarchy?id=${record.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating hierarchy');
    res.redirect('/settings/hierarchy');
  }
});

router.post('/hierarchy/:id/save', isAuthenticated, async (req, res) => {
  try {
    const { data, name } = req.body;
    const record = await Hierarchy.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Hierarchy not found' });
    }

    await record.update({
      name: name || record.name,
      data: JSON.stringify(data || [])
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Error saving hierarchy' });
  }
});

// Disconnect Google account
router.post('/google/disconnect', isAuthenticated, async (req, res) => {
  try {
    await req.user.update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      google_connected: false
    });

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'Disconnect Google Account',
      module: 'Settings',
      details: 'Google account disconnected',
      ip_address: req.ip
    });

    req.flash('success', 'Google account disconnected successfully');
    res.redirect('/settings/google');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error disconnecting Google account');
    res.redirect('/settings/google');
  }
});

// Notification preferences page
router.get('/notifications', isAuthenticated, async (req, res) => {
  try {
    res.render('settings/notifications', {
      title: 'Notification Settings',
      user: req.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading notification settings');
    res.redirect('/settings');
  }
});

router.get('/notifications/email', isAuthenticated, async (req, res) => {
  try {
    const emailConfigured = Boolean(process.env.EMAIL_USERNAME && (process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD));
    res.render('settings/email-notifications', {
      title: 'Email Notifications',
      user: req.user,
      emailConfigured,
      emailUsername: process.env.EMAIL_USERNAME || ''
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading email notification settings');
    res.redirect('/settings');
  }
});

router.post('/notifications/email', isAuthenticated, async (req, res) => {
  try {
    const {
      email_task_assigned,
      email_task_due_soon,
      email_task_overdue,
      email_task_completed,
      email_approval_request,
      email_approval_result
    } = req.body;

    await req.user.update({
      email_task_assigned: email_task_assigned === 'on',
      email_task_due_soon: email_task_due_soon === 'on',
      email_task_overdue: email_task_overdue === 'on',
      email_task_completed: email_task_completed === 'on',
      email_approval_request: email_approval_request === 'on',
      email_approval_result: email_approval_result === 'on'
    });

    req.flash('success', 'Preferensi email disimpan');
    res.redirect('/settings/notifications/email');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Gagal menyimpan preferensi email');
    res.redirect('/settings/notifications/email');
  }
});

// Update notification preferences
router.post('/notifications', isAuthenticated, async (req, res) => {
  try {
    const {
      notify_task_assigned,
      notify_task_completed,
      notify_task_deadline,
      notify_approval_request,
      notify_approval_result,
      notify_invoice,
      notify_payment,
      notify_matter
    } = req.body;

    await req.user.update({
      notify_task_assigned: notify_task_assigned === 'on',
      notify_task_completed: notify_task_completed === 'on',
      notify_task_deadline: notify_task_deadline === 'on',
      notify_approval_request: notify_approval_request === 'on',
      notify_approval_result: notify_approval_result === 'on',
      notify_invoice: notify_invoice === 'on',
      notify_payment: notify_payment === 'on',
      notify_matter: notify_matter === 'on'
    });

    req.flash('success', 'Notification preferences updated');
    res.redirect('/settings/notifications');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating notification preferences');
    res.redirect('/settings/notifications');
  }
});

// Send test email notification
router.post('/notifications/test', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    if (!user?.email) {
      req.flash('error', 'Email tidak tersedia di profil Anda');
      return res.redirect('/settings/notifications');
    }

    const message = notifications.taskAssigned('Test notification', user.full_name || 'User', new Date());
    const result = await sendNotification({ message, user, topic: 'task_assigned', link: '/settings/notifications' });

    if (result?.success) {
      req.flash('success', 'Test email berhasil dikirim ke ' + user.email);
    } else {
      req.flash('error', 'Gagal mengirim test email: ' + (result?.message || 'unknown error'));
    }
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error saat mengirim test email');
  }
  res.redirect('/settings/notifications');
});

// Send test email notification from email page
router.post('/notifications/email/test', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    const targetEmail = (req.body?.email || user?.email || '').trim();
    if (!targetEmail) {
      req.flash('error', 'Email tujuan kosong');
      return res.redirect('/settings/notifications/email');
    }

    const message = notifications.taskAssigned('Test notification', user.full_name || 'User', new Date());
    const result = await sendNotification({ message, user, topic: 'task_assigned', email: targetEmail, link: '/settings/notifications/email' });

    if (result?.success) {
      req.flash('success', 'Test email berhasil dikirim ke ' + targetEmail);
    } else {
      req.flash('error', 'Gagal mengirim test email: ' + (result?.message || 'unknown error'));
    }
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error saat mengirim test email');
  }
  res.redirect('/settings/notifications/email');
});

// Activity log
router.get('/activity', isAuthenticated, async (req, res) => {
  try {
    const logs = await ActivityLog.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 100
    });

    res.render('settings/activity', {
      title: 'Activity Log',
      logs
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading activity log');
    res.redirect('/settings');
  }
});

module.exports = router;
