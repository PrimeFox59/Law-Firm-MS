const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { Deposit, PaymentProof, Invoice, Contact, Matter, User } = require('../models');
const multer = require('multer');
const { Op } = require('sequelize');
const moment = require('moment');

// Configure multer for payment proof uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/payments/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Transactions page
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { tab = 'invoices', search } = req.query;
    const isAdmin = req.user?.account_type === 'admin';

    let invoices = [], deposits = [], payments = [];

    if (tab === 'invoices') {
      const where = isAdmin ? {} : { created_by: req.user.id };
      if (search) {
        where.invoice_number = { [Op.like]: `%${search}%` };
      }

      invoices = await Invoice.findAll({
        where,
        include: [
          { model: Contact, as: 'contact' },
          { model: Matter, as: 'matter' },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] }
        ],
        order: [['created_at', 'DESC']]
      });
    } else if (tab === 'deposits') {
      deposits = await Deposit.findAll({
        where: isAdmin ? {} : { created_by: req.user.id },
        include: [
          { model: Contact, as: 'contact' },
          { model: Matter, as: 'matter' },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] }
        ],
        order: [['created_at', 'DESC']]
      });
    } else if (tab === 'payments') {
      // Need invoices for dropdown selection in payment modal
      invoices = await Invoice.findAll({
        where: isAdmin ? {} : { created_by: req.user.id },
        include: [
          { model: Contact, as: 'contact' },
          { model: Matter, as: 'matter' }
        ],
        order: [['created_at', 'DESC']]
      });

      payments = await PaymentProof.findAll({
        where: isAdmin ? {} : { uploaded_by: req.user.id },
        include: [
          { 
            model: Invoice, 
            as: 'invoice',
            include: [
              { model: Contact, as: 'contact' },
              { model: Matter, as: 'matter' }
            ]
          },
          { model: User, as: 'uploader', attributes: ['id', 'full_name', 'email'] }
        ],
        order: [['created_at', 'DESC']]
      });
    }

    res.render('transactions/index', {
      title: 'Transactions',
      tab,
      invoices,
      deposits,
      payments,
      search: search || '',
      moment
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading transactions');
    res.redirect('/dashboard');
  }
});

// Add deposit page
router.get('/deposits/add', isAuthenticated, async (req, res) => {
  try {
    const contacts = await Contact.findAll({ where: { is_client: true } });
    const matters = await Matter.findAll({
      where: {
        [Op.or]: [
          { created_by: req.user.id },
          { responsible_attorney_id: req.user.id }
        ]
      }
    });

    res.render('transactions/deposit-form', {
      title: 'Add Deposit',
      contacts,
      matters
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading form');
    res.redirect('/transactions?tab=deposits');
  }
});

// Create deposit
router.post('/deposits', isAuthenticated, async (req, res) => {
  try {
    const { contact_id, matter_id, amount, deposit_date, notes } = req.body;

    await Deposit.create({
      contact_id,
      matter_id: matter_id || null,
      amount,
      deposit_date,
      notes,
      status: 'active',
      created_by: req.user.id
    });

    req.flash('success', 'Deposit created successfully');
    res.redirect('/transactions?tab=deposits');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating deposit');
    res.redirect('/transactions/deposits/add');
  }
});

// Upload payment proof
router.post('/payments', isAuthenticated, upload.single('proof_file'), async (req, res) => {
  try {
    const { invoice_id, amount, payment_date, payment_method, notes } = req.body;

    const payment = await PaymentProof.create({
      invoice_id,
      amount,
      payment_date,
      payment_method,
      proof_file: req.file ? req.file.path : null,
      notes,
      uploaded_by: req.user.id
    });

    // Update invoice paid amount
    const invoice = await Invoice.findByPk(invoice_id);
    if (invoice) {
      const newPaidAmount = parseFloat(invoice.paid_amount) + parseFloat(amount);
      await invoice.update({ 
        paid_amount: newPaidAmount,
        status: newPaidAmount >= invoice.total_amount ? 'paid' : 'partial'
      });
    }

    req.flash('success', 'Payment proof uploaded successfully');
    res.redirect('/transactions?tab=payments');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error uploading payment proof');
    res.redirect('/transactions?tab=payments');
  }
});

// Refund deposit
router.patch('/deposits/:id/refund', isAuthenticated, async (req, res) => {
  try {
    const deposit = await Deposit.findByPk(req.params.id);
    
    if (!deposit || deposit.created_by !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    await deposit.update({ status: 'refunded' });
    res.json({ success: true, message: 'Deposit refunded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error refunding deposit' });
  }
});

module.exports = router;
