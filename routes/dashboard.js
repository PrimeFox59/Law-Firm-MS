const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { 
  User, Matter, Task, Event, Invoice, 
  Contact, CostJournal, Document 
} = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user?.account_type === 'admin';
    const today = moment().startOf('day');
    const weekEnd = moment().endOf('week');
    const horizon = moment().add(30, 'days').endOf('day');

    // Open / upcoming tasks (next 30 days or undated)
    const todayTasks = await Task.findAll({
      where: {
        ...(isAdmin ? {} : { assignee_id: userId }),
        status: { [Op.not]: 'completed' },
        [Op.or]: [
          { due_date: { [Op.between]: [today.toDate(), horizon.toDate()] } },
          { due_date: null }
        ]
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [
        [Task.sequelize.literal('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END'), 'ASC'],
        ['due_date', 'ASC'],
        ['priority', 'DESC']
      ],
      limit: 15
    });

    // Tasks approaching deadline (due soonest first)
    const upcomingTasks = await Task.findAll({
      where: {
        ...(isAdmin ? {} : { assignee_id: userId }),
        status: { [Op.not]: 'completed' },
        due_date: { [Op.between]: [today.toDate(), horizon.toDate()] }
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [ ['due_date', 'ASC'], ['priority', 'DESC'] ],
      limit: 6
    });

    // Matters approaching deadline (end_date soon)
    const upcomingMatters = await Matter.findAll({
      where: {
        ...(isAdmin ? {} : {
          [Op.or]: [
            { created_by: userId },
            { responsible_attorney_id: userId }
          ]
        }),
        status: { [Op.not]: 'closed' },
        end_date: { [Op.between]: [today.toDate(), horizon.toDate()] }
      },
      include: [ { model: Contact, as: 'client' } ],
      order: [ ['end_date', 'ASC'] ],
      limit: 6
    });

    // Events this week
    const upcomingEvents = await Event.findAll({
      where: {
        ...(isAdmin ? {} : { created_by: userId }),
        start_datetime: {
          [Op.gte]: today.toDate(),
          [Op.lte]: weekEnd.toDate()
        }
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [['start_datetime', 'ASC']],
      limit: 20
    });

    // Events for calendar (month view) to make dates clickable
    const monthStart = moment().startOf('month');
    const monthEnd = moment().endOf('month');
    const monthEvents = await Event.findAll({
      where: {
        ...(isAdmin ? {} : { created_by: userId }),
        start_datetime: {
          [Op.gte]: monthStart.toDate(),
          [Op.lte]: monthEnd.toDate()
        }
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [['start_datetime', 'ASC']]
    });

    // Get recent tasks (fallback list)
    const recentTasks = await Task.findAll({
      where: {
        ...(isAdmin ? {} : { assignee_id: userId }),
        status: { [Op.not]: 'completed' }
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // Tasks needing approval (created by user, not completed)
    const approvalTasks = await Task.findAll({
      where: {
        created_by: userId,
        status: { [Op.not]: 'completed' }
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [['updated_at', 'DESC']],
      limit: 5
    });

    // Get matters summary
    const matters = await Matter.findAll({
      where: isAdmin ? {} : {
        [Op.or]: [
          { created_by: userId },
          { responsible_attorney_id: userId }
        ]
      },
      include: [
        { model: Contact, as: 'client' }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Get invoice summary
    const invoices = await Invoice.findAll({
      where: isAdmin ? {} : { created_by: userId },
      attributes: ['status', 'total_amount']
    });

    const invoiceSummary = {
      draft: { count: 0, total: 0 },
      unpaid: { count: 0, total: 0 },
      paid: { count: 0, total: 0 }
    };

    invoices.forEach(inv => {
      if (inv.status === 'draft') {
        invoiceSummary.draft.count++;
        invoiceSummary.draft.total += parseFloat(inv.total_amount);
      } else if (inv.status === 'paid') {
        invoiceSummary.paid.count++;
        invoiceSummary.paid.total += parseFloat(inv.total_amount);
      } else {
        invoiceSummary.unpaid.count++;
        invoiceSummary.unpaid.total += parseFloat(inv.total_amount);
      }
    });

    res.render('dashboard/index', {
      title: 'Dashboard',
      user: req.user,
      todayTasks,
      upcomingTasks,
      upcomingMatters,
      upcomingEvents,
      monthEvents,
      recentTasks,
      matters,
      invoiceSummary,
      approvalTasks,
      moment
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading dashboard');
    res.redirect('/');
  }
});

module.exports = router;
