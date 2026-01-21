const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { Invoice, InvoiceBill, Contact, Matter, CostJournal, PaymentProof, User } = require('../models');
const { Op, Sequelize } = require('sequelize');
const moment = require('moment');
const { sendNotification, notifications } = require('../utils/whatsappNotifier');

// List invoices
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { search, status } = req.query;
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;

    const baseWhere = {};

    if (status) {
      baseWhere.status = status;
    }

    if (search) {
      baseWhere.invoice_number = { [Op.like]: `%${search}%` };
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
              { created_by: userId },
              ...(matterIds.length ? [{ matter_id: { [Op.in]: matterIds } }] : [])
            ]
          }
        ]
      };
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Contact, as: 'contact' },
        { model: Matter, as: 'matter' }
      ],
      order: [['created_at', 'DESC']]
    });

    res.render('invoices/index', {
      title: 'Invoices',
      invoices,
      search: search || '',
      status: status || 'all',
      moment
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading invoices');
    res.redirect('/dashboard');
  }
});

// Create invoice page
router.get('/create', isAuthenticated, async (req, res) => {
  try {
    const contacts = await Contact.findAll({ where: { is_client: true } });
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;
    const matters = await Matter.findAll({
      where: isAdmin ? {} : {
        [Op.or]: [
          { created_by: userId },
          { responsible_attorney_id: userId },
          Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
        ]
      }
    });

    // Get unbilled cost journals
    const unbilledJournals = await CostJournal.findAll({
      where: {
        [Op.and]: [
          { is_billable: true, is_billed: false },
          ...(isAdmin ? [] : [{
            [Op.or]: [
              { user_id: userId },
              Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = CostJournal.matter_id AND ma.user_id = ${userId})`),
              Sequelize.literal(`EXISTS (SELECT 1 FROM matters m WHERE m.id = CostJournal.matter_id AND (m.created_by = ${userId} OR m.responsible_attorney_id = ${userId}))`)
            ]
          }])
        ]
      },
      include: [{ model: Matter, as: 'matter' }]
    });

    res.render('invoices/form', {
      title: 'Create Invoice',
      invoice: null,
      contacts,
      matters,
      unbilledJournals,
      action: 'create'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading form');
    res.redirect('/invoices');
  }
});

// Create invoice
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      invoice_number, contact_id, matter_id,
      issue_date, due_date, tax_rate, discount_amount,
      notes, bills
    } = req.body;

    // Calculate totals
    let subtotal = 0;
    const billsArray = Array.isArray(bills) ? bills : [bills];
    
    billsArray.forEach(bill => {
      if (bill && bill.description) {
        subtotal += parseFloat(bill.amount || 0);
      }
    });

    const taxAmount = (subtotal * parseFloat(tax_rate || 0)) / 100;
    const totalAmount = subtotal + taxAmount - parseFloat(discount_amount || 0);

    // Create invoice
    // For non-admin ensure matter belongs to user hierarchy
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
        req.flash('error', 'You can only invoice matters you are assigned to');
        return res.redirect('/invoices/create');
      }
    }

    const invoice = await Invoice.create({
      invoice_number,
      contact_id,
      matter_id: matter_id || null,
      issue_date,
      due_date,
      subtotal,
      tax_rate: tax_rate || 0,
      tax_amount: taxAmount,
      discount_amount: discount_amount || 0,
      total_amount: totalAmount,
      status: 'draft',
      notes,
      created_by: req.user.id
    });

    // Add invoice bills
    for (const bill of billsArray) {
      if (bill && bill.description) {
        await InvoiceBill.create({
          invoice_id: invoice.id,
          description: bill.description,
          quantity: bill.quantity || 1,
          unit_price: bill.unit_price,
          amount: bill.amount
        });
      }
    }

    req.flash('success', 'Invoice created successfully');

    // Send notification to responsible attorney if matter assigned (email)
    if (matter_id) {
      const matter = await Matter.findByPk(matter_id, {
        include: [
          { model: Contact, as: 'client', attributes: ['name'] },
          { model: User, as: 'responsibleAttorney' }
        ]
      });

      if (matter && matter.responsibleAttorney) {
        const message = notifications.invoiceCreated(
          invoice_number,
          matter.client?.name || 'Client',
          totalAmount,
          matter.responsibleAttorney.full_name
        );
        sendNotification({ message, user: matter.responsibleAttorney, topic: 'invoice', link: `/invoices/${invoice.id}` }).catch(err => console.error('Notification failed:', err));
      }
    }

    res.redirect('/invoices');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating invoice');
    res.redirect('/invoices/create');
  }
});

// View invoice detail
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;

    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Contact, as: 'contact' },
        { model: Matter, as: 'matter' },
        { model: InvoiceBill, as: 'bills' }
      ]
    });

    if (!invoice) {
      req.flash('error', 'Invoice not found');
      return res.redirect('/invoices');
    }

    if (!isAdmin) {
      const matterId = invoice.matter_id;
      let allowed = invoice.created_by === userId;
      if (!allowed && matterId) {
        const permittedMatter = await Matter.findOne({
          where: {
            id: matterId,
            [Op.or]: [
              { created_by: userId },
              { responsible_attorney_id: userId },
              Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
            ]
          }
        });
        allowed = !!permittedMatter;
      }

      if (!allowed) {
        req.flash('error', 'You are not allowed to view this invoice');
        return res.redirect('/invoices');
      }
    }

    res.render('invoices/detail', {
      title: 'Invoice Detail',
      invoice,
      moment
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading invoice');
    res.redirect('/invoices');
  }
});

// Update invoice status
router.patch('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    
    if (!invoice || invoice.created_by !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await invoice.update({ status: req.body.status });
    res.json({ success: true, message: 'Invoice status updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating invoice' });
  }
});

// Delete invoice
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    
    if (!invoice || invoice.created_by !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Can only delete draft invoices' });
    }

    // Prevent deleting invoices that already have related payments or cost journals
    const hasPayments = await PaymentProof.count({ where: { invoice_id: invoice.id } });
    if (hasPayments > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete: invoice has payment records' });
    }

    const hasCostJournals = await CostJournal.count({ where: { invoice_id: invoice.id } });
    if (hasCostJournals > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete: invoice linked to cost journals' });
    }

    // Remove invoice bills first to satisfy FK constraints
    await InvoiceBill.destroy({ where: { invoice_id: invoice.id } });

    await invoice.destroy();
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting invoice' });
  }
});

module.exports = router;
