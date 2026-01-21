const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { User } = require('../models');
const { buildRoleOptions, getActiveHierarchyTree, normalizeRole } = require('../utils/roleHierarchy');

// List users
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({ order: [['created_at', 'DESC']] });
    res.render('users/index', { title: 'Users', users });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load users');
    res.redirect('/dashboard');
  }
});

// Add form
router.get('/add', isAuthenticated, isAdmin, async (req, res) => {
  const tree = await getActiveHierarchyTree();
  const roleOptions = buildRoleOptions(tree, ['admin', 'attorney', 'staff', 'client']);
  res.render('users/form', { title: 'Add User', userData: null, roleOptions });
});

// Create
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { full_name, email, password, account_type, phone, hourly_rate, company } = req.body;
    await User.create({ full_name, email, password, account_type: normalizeRole(account_type), phone, hourly_rate, company });
    req.flash('success', 'User created');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create user');
  }
  res.redirect('/users');
});

// Edit form
router.get('/:id/edit', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userData = await User.findByPk(req.params.id);
    if (!userData) {
      req.flash('error', 'User not found');
      return res.redirect('/users');
    }
    const tree = await getActiveHierarchyTree();
    const roleOptions = buildRoleOptions(tree, ['admin', 'attorney', 'staff', 'client']);
    res.render('users/form', { title: 'Edit User', userData, roleOptions });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load user');
    res.redirect('/users');
  }
});

// Update
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userData = await User.findByPk(req.params.id);
    if (!userData) {
      req.flash('error', 'User not found');
      return res.redirect('/users');
    }
    const { full_name, email, password, account_type, phone, hourly_rate, company } = req.body;
    userData.full_name = full_name;
    userData.email = email;
    userData.account_type = normalizeRole(account_type);
    userData.phone = phone;
    userData.company = company;
    userData.hourly_rate = hourly_rate;
    if (password && password.trim().length >= 6) {
      userData.password = password; // hook will hash
    }
    await userData.save();
    req.flash('success', 'User updated');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update user');
  }
  res.redirect('/users');
});

// Delete
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/users');
    }
    const userData = await User.findByPk(req.params.id);
    if (!userData) {
      req.flash('error', 'User not found');
      return res.redirect('/users');
    }
    await userData.destroy();
    req.flash('success', 'User deleted');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete user');
  }
  res.redirect('/users');
});

module.exports = router;
