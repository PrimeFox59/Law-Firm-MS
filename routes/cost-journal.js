const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { CostJournal, Matter, User, CostJournalApproval, Deposit, Contact } = require('../models');
const { Op, Sequelize } = require('sequelize');
const moment = require('moment');
const { sendNotification, notifications } = require('../utils/whatsappNotifier');

// List cost journals
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { type = 'all', matter_id, start_date, end_date } = req.query;
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;

    const baseWhere = {};

    if (type !== 'all') {
      baseWhere.entry_type = type;
    }

    if (matter_id) {
      baseWhere.matter_id = matter_id;
    }

    if (start_date && end_date) {
      baseWhere.date = {
        [Op.between]: [start_date, end_date]
      };
    }

    let where = baseWhere;

    if (!isAdmin) {
      const accessibleMatters = await Matter.findAll({
        where: {
          [Op.or]: [
            { created_by: userId },
            { responsible_attorney_id: userId },
            Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
          ]
        },
        attributes: ['id']
      });

      const matterIds = accessibleMatters.map(m => m.id);

      where = {
        [Op.and]: [
          baseWhere,
          {
            [Op.or]: [
              { user_id: userId },
              ...(matterIds.length ? [{ matter_id: { [Op.in]: matterIds } }] : [])
            ]
          }
        ]
      };
    }

    const journals = await CostJournal.findAll({
      where,
      include: [
        { model: Matter, as: 'matter', include: [{ model: Contact, as: 'client' }] },
        {
          model: CostJournalApproval,
          as: 'approval',
          include: [
            { model: User, as: 'approver', attributes: ['id', 'full_name'] },
            { model: User, as: 'requester', attributes: ['id', 'full_name'] }
          ]
        }
      ],
      order: [['date', 'DESC']]
    });

    const matters = await Matter.findAll({
      where: isAdmin ? {} : {
        [Op.or]: [
          { created_by: userId },
          { responsible_attorney_id: userId },
          Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
        ]
      }
    });

    // Calculate totals
    const totals = {
      billable: 0,
      nonBillable: 0,
      hours: 0,
      expenses: 0
    };

    journals.forEach(j => {
      if (j.entry_type === 'time') {
        totals.hours += parseFloat(j.hours || 0);
        const amount = parseFloat(j.hours || 0) * parseFloat(j.rate || 0);
        if (j.is_billable) totals.billable += amount;
        else totals.nonBillable += amount;
      } else {
        const amount = parseFloat(j.amount || 0);
        totals.expenses += amount;
        if (j.is_billable) totals.billable += amount;
        else totals.nonBillable += amount;
      }
    });

    res.render('cost-journal/index', {
      title: 'Cost Journal',
      journals,
      matters,
      totals,
      type,
      matter_id: matter_id || 'all',
      start_date: start_date || '',
      end_date: end_date || '',
      moment,
      user: req.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading cost journal');
    res.redirect('/dashboard');
  }
});

// Submit for approval
router.post('/:id/submit', isAuthenticated, async (req, res) => {
  try {
    const journal = await CostJournal.findByPk(req.params.id, {
      include: [{ model: CostJournalApproval, as: 'approval' }]
    });

    if (!journal || (journal.user_id !== req.user.id && req.user.account_type !== 'admin')) {
      req.flash('error', 'Entry not found');
      return res.redirect('/cost-journal');
    }

    // pick approver: first admin or fallback to creator (self)
    const approver = await User.findOne({ where: { account_type: 'admin' }, order: [['id', 'ASC']], attributes: ['id', 'full_name', 'phone'] }) || req.user;

    if (journal.approval) {
      await journal.approval.update({ status: 'pending', requested_by: req.user.id, approver_id: approver.id });
    } else {
      await CostJournalApproval.create({
        cost_journal_id: journal.id,
        status: 'pending',
        requested_by: req.user.id,
        approver_id: approver.id
      });
    }

    // Send notification to approver (email)
    if (approver && approver.id !== req.user.id) {
      const amount = journal.entry_type === 'time'
        ? parseFloat(journal.hours || 0) * parseFloat(journal.rate || 0)
        : parseFloat(journal.amount || 0);
      const message = notifications.costJournalPendingApproval(
        journal.description || 'Cost journal',
        amount,
        req.user.full_name,
        approver.full_name
      );
      sendNotification({ message, user: approver, topic: 'approval_request', link: '/cost-journal' }).catch(err => console.error('Notification failed:', err));
    }

    req.flash('success', 'Submitted for approval');
    res.redirect('/cost-journal');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error submitting for approval');
    res.redirect('/cost-journal');
  }
});

// Approve
router.post('/:id/approve', isAuthenticated, async (req, res) => {
  try {
    const journal = await CostJournal.findByPk(req.params.id, {
      include: [
        { model: CostJournalApproval, as: 'approval' },
        { model: Matter, as: 'matter', include: [{ model: Contact, as: 'client' }] }
      ]
    });

    if (!journal || !journal.approval || journal.approval.status !== 'pending') {
      req.flash('error', 'Approval not available');
      return res.redirect('/cost-journal');
    }

    if (journal.approval.approver_id !== req.user.id && req.user.account_type !== 'admin') {
      req.flash('error', 'Not allowed to approve');
      return res.redirect('/cost-journal');
    }

    const matter = journal.matter;
    if (!matter || !matter.client) {
      req.flash('error', 'Cannot create transaction: matter or client missing');
      return res.redirect('/cost-journal');
    }

    // compute amount
    const amount = journal.entry_type === 'time'
      ? parseFloat(journal.hours || 0) * parseFloat(journal.rate || 0)
      : parseFloat(journal.amount || 0);

    // create deposit as transaction record
    await Deposit.create({
      contact_id: matter.client_id,
      matter_id: matter.id,
      amount: amount,
      deposit_date: new Date(),
      status: 'active',
      notes: `Auto from cost journal #${journal.id}`,
      created_by: req.user.id
    });

    await journal.update({ is_billed: true });
    await journal.approval.update({ status: 'approved' });

    // Send notification to requester (email)
    const requester = await User.findByPk(journal.approval.requested_by);
    if (requester) {
      const message = notifications.costJournalApproved(
        journal.description || 'Cost journal',
        req.user.full_name,
        requester.full_name
      );
      sendNotification({ message, user: requester, topic: 'approval_result', link: '/cost-journal' }).catch(err => console.error('Notification failed:', err));
    }

    req.flash('success', 'Approved and sent to Transactions');
    res.redirect('/cost-journal');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error approving entry');
    res.redirect('/cost-journal');
  }
});

// Reject
router.post('/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const journal = await CostJournal.findByPk(req.params.id, {
      include: [{ model: CostJournalApproval, as: 'approval' }]
    });

    if (!journal || !journal.approval || journal.approval.status !== 'pending') {
      req.flash('error', 'Approval not available');
      return res.redirect('/cost-journal');
    }

    if (journal.approval.approver_id !== req.user.id && req.user.account_type !== 'admin') {
      req.flash('error', 'Not allowed to reject');
      return res.redirect('/cost-journal');
    }

    await journal.approval.update({ status: 'rejected' });

    // Send notification to requester (email)
    const requester = await User.findByPk(journal.approval.requested_by);
    if (requester) {
      const message = notifications.costJournalRejected(
        journal.description || 'Cost journal',
        req.user.full_name,
        requester.full_name,
        req.body.reason || ''
      );
      sendNotification({ message, user: requester, topic: 'approval_result', link: '/cost-journal' }).catch(err => console.error('Notification failed:', err));
    }

    req.flash('success', 'Entry rejected');
    res.redirect('/cost-journal');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error rejecting entry');
    res.redirect('/cost-journal');
  }
});

// Matter options for quick add
router.get('/matters-options', isAuthenticated, async (req, res) => {
  try {
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;
    const matters = await Matter.findAll({
      where: isAdmin ? {} : {
        [Op.or]: [
          { created_by: userId },
          { responsible_attorney_id: userId },
          Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
        ]
      },
      attributes: ['id', 'matter_name'],
      order: [['matter_name', 'ASC']]
    });

    res.json({ success: true, matters });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error loading matters' });
  }
});

// Add time entry
router.post('/time', isAuthenticated, async (req, res) => {
  try {
    const { matter_id, date, description, hours, is_billable } = req.body;

    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;
    if (!isAdmin && matter_id) {
      const permittedMatter = await Matter.findOne({
        where: {
          id: matter_id,
          [Op.or]: [
            { created_by: userId },
            { responsible_attorney_id: userId },
            Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
          ]
        }
      });

      if (!permittedMatter) {
        req.flash('error', 'You can only log time to matters you are assigned to');
        return res.redirect('/cost-journal');
      }
    }

    await CostJournal.create({
      entry_type: 'time',
      matter_id: matter_id || null,
      user_id: req.user.id,
      date,
      description,
      hours,
      rate: req.user.hourly_rate,
      is_billable: is_billable === 'true'
    });

    req.flash('success', 'Time entry added successfully');
    res.redirect('/cost-journal');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding time entry');
    res.redirect('/cost-journal');
  }
});

// Add expense entry
router.post('/expense', isAuthenticated, async (req, res) => {
  try {
    const { matter_id, date, description, expense_category, amount, is_billable } = req.body;

    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;
    if (!isAdmin && matter_id) {
      const permittedMatter = await Matter.findOne({
        where: {
          id: matter_id,
          [Op.or]: [
            { created_by: userId },
            { responsible_attorney_id: userId },
            Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
          ]
        }
      });

      if (!permittedMatter) {
        req.flash('error', 'You can only log expenses to matters you are assigned to');
        return res.redirect('/cost-journal');
      }
    }

    await CostJournal.create({
      entry_type: 'expense',
      matter_id: matter_id || null,
      user_id: req.user.id,
      date,
      description,
      expense_category,
      amount,
      is_billable: is_billable === 'true'
    });

    req.flash('success', 'Expense entry added successfully');
    res.redirect('/cost-journal');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding expense entry');
    res.redirect('/cost-journal');
  }
});

// Delete entry
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const journal = await CostJournal.findByPk(req.params.id);
    
    if (!journal || journal.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    if (journal.is_billed) {
      return res.status(400).json({ success: false, message: 'Cannot delete billed entry' });
    }

    await journal.destroy();
    res.json({ success: true, message: 'Entry deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting entry' });
  }
});

module.exports = router;
