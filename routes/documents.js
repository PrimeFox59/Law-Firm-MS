const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { Document, Matter, Contact, Task, User } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op, Sequelize } = require('sequelize');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB
});

// List documents
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { parent_id = null, search, matter_id, contact_id } = req.query;
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;

    const baseWhere = { is_deleted: false };

    if (parent_id) {
      baseWhere.parent_id = parent_id;
    } else {
      baseWhere.parent_id = null;
    }

    if (search) {
      baseWhere.name = { [Op.like]: `%${search}%` };
    }

    if (matter_id) {
      baseWhere.matter_id = matter_id;
    }

    if (contact_id) {
      baseWhere.contact_id = contact_id;
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

    const documents = await Document.findAll({
      where,
      include: [
        { model: Matter, as: 'matter' },
        { model: Contact, as: 'contact' },
        { model: Task, as: 'task', attributes: ['id', 'title'] },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] }
      ],
      order: [
        ['type', 'DESC'], // Folders first
        ['name', 'ASC']
      ]
    });

    // Get current folder info
    let currentFolder = null;
    if (parent_id) {
      currentFolder = await Document.findByPk(parent_id);
    }

    const matters = await Matter.findAll({
      where: isAdmin ? {} : {
        [Op.or]: [
          { created_by: userId },
          { responsible_attorney_id: userId },
          Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
        ]
      }
    });

    const contacts = await Contact.findAll();

    res.render('documents/index', {
      title: 'Documents',
      documents,
      currentFolder,
      matters,
      contacts,
      search: search || '',
      matter_id: matter_id || 'all',
      contact_id: contact_id || 'all'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading documents');
    res.redirect('/dashboard');
  }
});

// Add folder
router.post('/folder', isAuthenticated, async (req, res) => {
  try {
    const { name, parent_id, matter_id, contact_id } = req.body;

    await Document.create({
      name,
      type: 'folder',
      parent_id: parent_id || null,
      matter_id: matter_id || null,
      contact_id: contact_id || null,
      created_by: req.user.id
    });

    req.flash('success', 'Folder created successfully');
    res.redirect(`/documents${parent_id ? '?parent_id=' + parent_id : ''}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating folder');
    res.redirect('/documents');
  }
});

// Upload file
router.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const { parent_id, matter_id, contact_id } = req.body;

    await Document.create({
      name: req.file.originalname,
      type: 'file',
      parent_id: parent_id || null,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      matter_id: matter_id || null,
      contact_id: contact_id || null,
      created_by: req.user.id
    });

    req.flash('success', 'File uploaded successfully');
    res.redirect(`/documents${parent_id ? '?parent_id=' + parent_id : ''}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error uploading file');
    res.redirect('/documents');
  }
});

// Reupload (new revision)
router.post('/:id/reupload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document || document.is_deleted) {
      req.flash('error', 'Document not found');
      return res.redirect('/documents');
    }

    if (!req.file) {
      req.flash('error', 'File is required');
      return res.redirect('/documents');
    }

    const nextRevision = (document.revision_number || 0) + 1;

    await document.update({
      name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      revision_number: nextRevision
    });

    req.flash('success', `File reuploaded. Revision ${nextRevision}`);
    res.redirect('/documents');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error reuploading file');
    res.redirect('/documents');
  }
});

// Move to trash (soft delete)
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    
    if (!document || document.created_by !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    await document.update({ 
      is_deleted: true,
      deleted_at: new Date()
    });

    res.json({ success: true, message: 'Moved to trash' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting document' });
  }
});

module.exports = router;
