const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { Contact, ContactEmail, ContactPhone, ContactAddress } = require('../models');
const { Op } = require('sequelize');
const useFirestore = process.env.FIRESTORE_ENABLED === 'true';
const fsContacts = useFirestore ? require('../services/firestore/contacts') : null;

// List contacts
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { search, filter } = req.query;
    if (useFirestore) {
      const contacts = await fsContacts.list({ search, filter });
      res.render('contacts/index', {
        title: 'Contacts',
        contacts,
        search: search || '',
        filter: filter || 'all'
      });
      return;
    }

    const where = {};

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (filter === 'client') {
      where.is_client = true;
    } else if (filter === 'non-client') {
      where.is_client = false;
    }

    const contacts = await Contact.findAll({
      where,
      include: [
        { model: ContactEmail, as: 'emails', where: { is_primary: true }, required: false },
        { model: ContactPhone, as: 'phones', where: { is_primary: true }, required: false },
        { model: ContactAddress, as: 'addresses', where: { is_primary: true }, required: false }
      ],
      order: [['created_at', 'DESC']]
    });

    res.render('contacts/index', {
      title: 'Contacts',
      contacts,
      search: search || '',
      filter: filter || 'all'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading contacts');
    res.redirect('/dashboard');
  }
});

// Add contact page
router.get('/add', isAuthenticated, (req, res) => {
  res.render('contacts/form', {
    title: 'Add Contact',
    contact: null,
    action: 'add'
  });
});

// Create contact
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { 
      entity_type, name, is_client, notes,
      emails, phones, addresses 
    } = req.body;

    const contact = await Contact.create({
      entity_type,
      name,
      is_client: is_client === 'true',
      notes,
      created_by: req.user.id
    });

    // Add emails
    if (emails && Array.isArray(emails)) {
      for (let i = 0; i < emails.length; i++) {
        if (emails[i].email) {
          await ContactEmail.create({
            contact_id: contact.id,
            email: emails[i].email,
            email_type: emails[i].type || 'personal',
            is_primary: i === 0
          });
        }
      }
    }

    // Add phones
    if (phones && Array.isArray(phones)) {
      for (let i = 0; i < phones.length; i++) {
        if (phones[i].phone) {
          await ContactPhone.create({
            contact_id: contact.id,
            phone: phones[i].phone,
            phone_type: phones[i].type || 'mobile',
            is_primary: i === 0
          });
        }
      }
    }

    // Add addresses
    if (addresses && Array.isArray(addresses)) {
      for (let i = 0; i < addresses.length; i++) {
        if (addresses[i].address) {
          await ContactAddress.create({
            contact_id: contact.id,
            address: addresses[i].address,
            address_type: addresses[i].type || 'home',
            is_primary: i === 0
          });
        }
      }
    }

    if (useFirestore) {
      await fsContacts.create({
        id: contact.id,
        entity_type,
        name,
        is_client: is_client === 'true',
        notes,
        created_by: req.user.id ? String(req.user.id) : null,
        emails,
        phones,
        addresses
      });
    }

    req.flash('success', 'Contact created successfully');
    res.redirect('/contacts');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating contact');
    res.redirect('/contacts/add');
  }
});

// Edit contact page
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    let contact;
    if (useFirestore) {
      contact = await fsContacts.findById(req.params.id);
    } else {
      contact = await Contact.findByPk(req.params.id, {
        include: [
          { model: ContactEmail, as: 'emails' },
          { model: ContactPhone, as: 'phones' },
          { model: ContactAddress, as: 'addresses' }
        ]
      });
    }

    if (!contact) {
      req.flash('error', 'Contact not found');
      return res.redirect('/contacts');
    }

    res.render('contacts/form', {
      title: 'Edit Contact',
      contact,
      action: 'edit'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading contact');
    res.redirect('/contacts');
  }
});

// Delete contact
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    if (useFirestore) {
      await fsContacts.remove(req.params.id);
    }

    const contact = await Contact.findByPk(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await contact.destroy();
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting contact' });
  }
});

module.exports = router;
