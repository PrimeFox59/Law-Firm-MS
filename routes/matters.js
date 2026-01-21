const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const { Matter, Contact, User, ChatMessage, Task, Document, Invoice, CostJournal, MatterAttorney } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { getActiveHierarchyTree, getDescendantRoles, getAssignableRolesForUser } = require('../utils/roleHierarchy');
const useFirestore = process.env.FIRESTORE_ENABLED === 'true';
const fsMatters = useFirestore ? require('../services/firestore/matters') : null;

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
// No file size cap; rely on server capacity/storage
const upload = multer({ storage });

const chatUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
  }
});

// Wrap multer to surface user-friendly errors in UI instead of 500 page
const handleUpload = (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          req.flash('error', 'Too many files uploaded. Max 10 at once.');
        } else {
          req.flash('error', `Upload error: ${err.code}`);
        }
      } else {
        req.flash('error', 'Upload error. Please try again.');
      }
      return res.redirect(`/matters/${req.params.id}`);
    }
    next();
  });
};

const handleChatUpload = (req, res, next) => {
  chatUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          req.flash('error', 'Image too large. Max size is 10MB.');
        } else {
          req.flash('error', 'Only image files are allowed for chat.');
        }
      } else {
        req.flash('error', 'Upload error. Please try again.');
      }
      return res.redirect(`/matters/${req.params.id}`);
    }
    next();
  });
};

// List matters with filters/search
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { search = '', status = 'all', dispute = 'all' } = req.query;
    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;

    const filters = [];
    const searchTerm = search.trim();

    // Restrict non-admins to their matters
    if (!isAdmin) {
      filters.push({
        [Op.or]: [
          { created_by: userId },
          { responsible_attorney_id: userId },
          Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
        ]
      });
    }

    if (searchTerm) {
      const like = `%${searchTerm}%`;
      filters.push({
        [Op.or]: [
          { matter_name: { [Op.like]: like } },
          { matter_number: { [Op.like]: like } }
        ]
      });
    }

    if (status !== 'all') {
      filters.push({ status });
    }

    if (dispute !== 'all') {
      filters.push({ dispute_resolution: dispute });
    }

    const where = filters.length ? { [Op.and]: filters } : {};

    const matters = await Matter.findAll({
      where,
      include: [
        { model: Contact, as: 'client' },
        { model: User, as: 'responsibleAttorney' },
        { model: User, as: 'responsibleAttorneys', through: { attributes: [] } }
      ],
      order: [['created_at', 'DESC']],
      distinct: true
    });

    res.render('matters/index', {
      title: 'Matters',
      matters,
      search: searchTerm,
      status,
      dispute
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading matters');
    res.redirect('/dashboard');
  }
});

// Add matter page
router.get('/add', isAuthenticated, async (req, res) => {
  try {
    const clients = await Contact.findAll({ where: { is_client: true } });
    const tree = await getActiveHierarchyTree();
    const attorneyRoles = getDescendantRoles(tree, 'attorney', true);
    const allowedRoleSlugs = ['admin', ...(attorneyRoles.length ? attorneyRoles : ['attorney'])];

    const attorneys = await User.findAll({ 
      where: { 
        account_type: { [Op.in]: allowedRoleSlugs },
        is_active: true
      } 
    });

    res.render('matters/form', {
      title: 'Add Matter',
      matter: null,
      clients,
      attorneys,
      action: 'add'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading form');
    res.redirect('/matters');
  }
});

// Edit matter page
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id, {
      include: [
        { model: User, as: 'responsibleAttorneys', through: { attributes: [] } }
      ]
    });

    if (!matter) {
      req.flash('error', 'Matter not found');
      return res.redirect('/matters');
    }

    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;
    if (!isAdmin) {
      const allowed = matter.created_by === userId || matter.responsible_attorney_id === userId;
      const shared = await MatterAttorney.findOne({ where: { matter_id: matter.id, user_id: userId } });
      if (!allowed && !shared) {
        req.flash('error', 'You are not allowed to edit this matter');
        return res.redirect('/matters');
      }
    }

    const clients = await Contact.findAll({ where: { is_client: true } });
    const tree = await getActiveHierarchyTree();
    const attorneyRoles = getDescendantRoles(tree, 'attorney', true);
    const allowedRoleSlugs = ['admin', ...(attorneyRoles.length ? attorneyRoles : ['attorney'])];

    const attorneys = await User.findAll({
      where: {
        account_type: { [Op.in]: allowedRoleSlugs },
        is_active: true
      }
    });

    res.render('matters/form', {
      title: 'Edit Matter',
      matter,
      clients,
      attorneys,
      action: 'edit'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading matter');
    res.redirect('/matters');
  }
});

// Create matter
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      matter_number, matter_name, client_id, responsible_attorney_ids,
      case_area, case_type, dispute_resolution, status,
      start_date, end_date, max_budget, payment_method, description
    } = req.body;

    const attorneyIds = Array.isArray(responsible_attorney_ids)
      ? responsible_attorney_ids
      : responsible_attorney_ids
        ? [responsible_attorney_ids]
        : [];

    const uniqueAttorneyIds = [...new Set(attorneyIds.map(id => Number(id)).filter(Boolean))];

    if (!uniqueAttorneyIds.length) {
      req.flash('error', 'Please select at least one responsible attorney');
      return res.redirect('/matters/add');
    }

    const leadAttorneyId = uniqueAttorneyIds[0];

    const matter = await Matter.create({
      matter_number,
      matter_name,
      client_id,
      responsible_attorney_id: leadAttorneyId,
      case_area,
      case_type,
      dispute_resolution,
      status,
      start_date: start_date || null,
      end_date: end_date || null,
      max_budget: max_budget || null,
      payment_method,
      description,
      created_by: req.user.id
    });

    if (useFirestore && matter) {
      await fsMatters.create({
        id: matter.id,
        matter_number,
        matter_name,
        client_id: client_id ? String(client_id) : null,
        responsible_attorney_id: leadAttorneyId ? String(leadAttorneyId) : null,
        responsible_attorney_ids: uniqueAttorneyIds.map(String),
        visible_to: Array.from(new Set([req.user.id, leadAttorneyId, ...uniqueAttorneyIds].map(String).filter(Boolean))),
        case_area,
        case_type,
        dispute_resolution,
        status,
        start_date: start_date || null,
        end_date: end_date || null,
        max_budget: max_budget || null,
        payment_method,
        description,
        created_by: req.user.id ? String(req.user.id) : null
      });
    }

    if (matter && uniqueAttorneyIds.length) {
      const payload = uniqueAttorneyIds.map(userId => ({ matter_id: matter.id, user_id: userId }));
      await MatterAttorney.bulkCreate(payload, { ignoreDuplicates: true });
    }

    req.flash('success', 'Matter created successfully');
    res.redirect('/matters');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating matter');
    res.redirect('/matters/add');
  }
});

// Update matter
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id);
    if (!matter) {
      req.flash('error', 'Matter not found');
      return res.redirect('/matters');
    }

    const isAdmin = req.user?.account_type === 'admin';
    const userId = Number(req.user.id) || 0;
    if (!isAdmin) {
      const allowed = matter.created_by === userId || matter.responsible_attorney_id === userId;
      const shared = await MatterAttorney.findOne({ where: { matter_id: matter.id, user_id: userId } });
      if (!allowed && !shared) {
        req.flash('error', 'You are not allowed to edit this matter');
        return res.redirect('/matters');
      }
    }

    const {
      matter_number, matter_name, client_id, responsible_attorney_ids,
      case_area, case_type, dispute_resolution, status,
      start_date, end_date, max_budget, payment_method, description
    } = req.body;

    const attorneyIds = Array.isArray(responsible_attorney_ids)
      ? responsible_attorney_ids
      : responsible_attorney_ids
        ? [responsible_attorney_ids]
        : [];

    const uniqueAttorneyIds = [...new Set(attorneyIds.map(id => Number(id)).filter(Boolean))];

    if (!uniqueAttorneyIds.length) {
      req.flash('error', 'Please select at least one responsible attorney');
      return res.redirect(`/matters/${req.params.id}/edit`);
    }

    const leadAttorneyId = uniqueAttorneyIds[0];

    await matter.update({
      matter_number,
      matter_name,
      client_id,
      responsible_attorney_id: leadAttorneyId,
      case_area,
      case_type,
      dispute_resolution,
      status,
      start_date: start_date || null,
      end_date: end_date || null,
      max_budget: max_budget || null,
      payment_method,
      description
    });

    if (useFirestore) {
      await fsMatters.update(matter.id, {
        matter_number,
        matter_name,
        client_id: client_id ? String(client_id) : null,
        responsible_attorney_id: leadAttorneyId ? String(leadAttorneyId) : null,
        responsible_attorney_ids: uniqueAttorneyIds.map(String),
        visible_to: Array.from(new Set([req.user.id, leadAttorneyId, ...uniqueAttorneyIds].map(String).filter(Boolean))),
        case_area,
        case_type,
        dispute_resolution,
        status,
        start_date: start_date || null,
        end_date: end_date || null,
        max_budget: max_budget || null,
        payment_method,
        description
      });
    }

    await MatterAttorney.destroy({ where: { matter_id: matter.id } });
    const payload = uniqueAttorneyIds.map(userIdItem => ({ matter_id: matter.id, user_id: userIdItem }));
    if (payload.length) {
      await MatterAttorney.bulkCreate(payload, { ignoreDuplicates: true });
    }

    if (useFirestore) {
      await fsMatters.setAttorneys(matter.id, uniqueAttorneyIds);
    }

    req.flash('success', 'Matter updated successfully');
    res.redirect(`/matters/${matter.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating matter');
    res.redirect(`/matters/${req.params.id}/edit`);
  }
});

// View matter detail
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id, {
      include: [
        { model: Contact, as: 'client' },
        { model: User, as: 'responsibleAttorney' },
        { model: User, as: 'responsibleAttorneys', through: { attributes: [] } },
        { model: User, as: 'creator' }
      ]
    });

    if (!matter) {
      req.flash('error', 'Matter not found');
      return res.redirect('/matters');
    }

    const messages = await ChatMessage.findAll({
      where: { matter_id: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'account_type'] }],
      order: [['created_at', 'ASC']]
    });

    const tasks = await Task.findAll({
      where: { matter_id: req.params.id },
      include: [{ model: User, as: 'assignee', attributes: ['id', 'full_name', 'account_type'] }],
      order: [['created_at', 'DESC']]
    });

    const tree = await getActiveHierarchyTree();
    const assignableRoles = getAssignableRolesForUser(tree, req.user.account_type, req.user?.account_type === 'admin');
    const assignees = await User.findAll({
      where: {
        is_active: true,
        ...(assignableRoles ? { account_type: { [Op.in]: assignableRoles } } : {})
      },
      attributes: ['id', 'full_name', 'account_type']
    });

    const documents = await Document.findAll({
      where: { matter_id: req.params.id, is_deleted: false },
      order: [['created_at', 'DESC']]
    });

    const invoices = await Invoice.findAll({
      where: { matter_id: req.params.id },
      order: [['created_at', 'DESC']]
    });

    const costJournals = await CostJournal.findAll({
      where: { matter_id: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name'] }],
      order: [['date', 'DESC']]
    });

    res.render('matters/detail', {
      title: 'Matter Detail',
      matter,
      messages,
      tasks,
      assignees,
      documents,
      invoices,
      costJournals
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading matter');
    res.redirect('/matters');
  }
});

// Paginated chat messages (JSON)
router.get('/:id/discuss/list', isAuthenticated, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id);
    if (!matter) return res.status(404).json({ success: false, message: 'Matter not found' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 20));
    const search = (req.query.search || '').trim();

    const where = {
      matter_id: req.params.id,
      ...(search ? { message: { [Op.like]: `%${search}%` } } : {})
    };

    const total = await ChatMessage.count({ where });
    const messages = await ChatMessage.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'account_type'] }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    const cleaned = messages.reverse().map(m => {
      const imgMatch = (m.message || '').match(/Image: (\/uploads\/[^\s]+)/);
      const imagePath = imgMatch ? imgMatch[1] : null;
      const textOnly = imagePath ? m.message.replace(/Image: \/uploads\/[^\s]+/, '').trim() : m.message;
      return {
        id: m.id,
        matter_id: m.matter_id,
        message: m.message,
        text: textOnly,
        imagePath,
        user: m.user,
        created_at: m.created_at || m.createdAt
      };
    });

    res.json({
      success: true,
      messages: cleaned,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error loading messages' });
  }
});

// Add chat/discussion message
router.post('/:id/discuss', isAuthenticated, handleChatUpload, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id);
    if (!matter) {
      req.flash('error', 'Matter not found');
      return res.redirect('/matters');
    }

    const text = (req.body.message || '').trim();
    const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

    const wantsJSON = (req.headers.accept || '').includes('application/json') || req.xhr;

    if (!text && !filePath) {
      if (wantsJSON) return res.status(400).json({ success: false, message: 'Message or image is required' });
      req.flash('error', 'Message or image is required');
      return res.redirect(`/matters/${req.params.id}`);
    }

    const messageBody = text && filePath
      ? `${text}\nImage: /${filePath}`
      : text || `Image: /${filePath}`;

    const created = await ChatMessage.create({
      matter_id: req.params.id,
      user_id: req.user.id,
      message: messageBody
    });

    const saved = await ChatMessage.findByPk(created.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'account_type'] }]
    });

    const imgMatch = (saved.message || '').match(/Image: (\/uploads\/[^\s]+)/);
    const imagePath = imgMatch ? imgMatch[1] : null;
    const textOnly = imagePath ? saved.message.replace(/Image: \/uploads\/[^\s]+/, '').trim() : saved.message;

    const createdAt = saved.created_at || saved.createdAt;
    const payload = {
      id: saved.id,
      matter_id: Number(req.params.id),
      message: saved.message,
      text: textOnly,
      imagePath,
      user: saved.user,
      created_at: createdAt
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`matter:${req.params.id}`).emit('chat:new', payload);

      // Notify participants (creator, responsible attorney, shared attorneys)
      const participantIds = new Set([req.user.id, matter.created_by, matter.responsible_attorney_id]);
      const shared = await MatterAttorney.findAll({ where: { matter_id: matter.id }, attributes: ['user_id'] });
      shared.forEach(s => participantIds.add(s.user_id));

      participantIds.forEach(uid => {
        if (uid) {
          io.to(`user:${uid}`).emit('matter:new', {
            matter_id: matter.id,
            matter_name: matter.matter_name,
            message: textOnly || 'Image',
            from_user: saved.user,
            created_at: createdAt
          });
        }
      });
    }

    if (wantsJSON) {
      return res.json({ success: true, message: payload });
    }

    res.redirect(`/matters/${req.params.id}`);
  } catch (error) {
    console.error(error);
    if ((req.headers.accept || '').includes('application/json') || req.xhr) {
      res.status(500).json({ success: false, message: 'Error posting message' });
    } else {
      req.flash('error', 'Error posting message');
      res.redirect(`/matters/${req.params.id}`);
    }
  }
});

// Quick-create task from matter
router.post('/:id/tasks', isAuthenticated, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id);
    if (!matter) {
      req.flash('error', 'Matter not found');
      return res.redirect('/matters');
    }

    const { title, description, due_date, priority = 'medium', assignee_id } = req.body;
    if (!title || !assignee_id) {
      req.flash('error', 'Title and assignee are required');
      return res.redirect(`/matters/${req.params.id}`);
    }

    const tree = await getActiveHierarchyTree();
    const assignableRoles = getAssignableRolesForUser(tree, req.user.account_type, req.user?.account_type === 'admin');

    if (assignableRoles) {
      const assignee = await User.findByPk(assignee_id, { attributes: ['id', 'account_type'] });
      if (!assignee || !assignableRoles.includes(assignee.account_type)) {
        req.flash('error', 'You can only assign tasks to roles below your hierarchy');
        return res.redirect(`/matters/${req.params.id}`);
      }
    }

    await Task.create({
      task_type: 'matter',
      matter_id: req.params.id,
      title,
      description,
      status: 'pending',
      priority,
      start_date: null,
      due_date: due_date || null,
      assignee_id,
      created_by: req.user.id
    });

    req.flash('success', 'Task created');
    res.redirect(`/matters/${req.params.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating task');
    res.redirect(`/matters/${req.params.id}`);
  }
});

// Upload document to matter
router.post('/:id/documents', isAuthenticated, handleUpload, async (req, res) => {
  try {
    const matter = await Matter.findByPk(req.params.id);
    if (!matter) {
      req.flash('error', 'Matter not found');
      return res.redirect('/matters');
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      req.flash('error', 'At least one file is required');
      return res.redirect(`/matters/${req.params.id}`);
    }

    const docsPayload = files.map(f => ({
      name: f.originalname,
      type: 'file',
      parent_id: null,
      file_path: f.path,
      file_size: f.size,
      mime_type: f.mimetype,
      matter_id: req.params.id,
      contact_id: null,
      created_by: req.user.id
    }));

    await Document.bulkCreate(docsPayload);

    req.flash('success', files.length > 1 ? `${files.length} documents uploaded` : 'Document uploaded');
    res.redirect(`/matters/${req.params.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error uploading document');
    res.redirect(`/matters/${req.params.id}`);
  }
});

// Delete matter
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    if (useFirestore) {
      await fsMatters.update(req.params.id, { deleted: true });
    }

    const matter = await Matter.findByPk(req.params.id);
    
    if (!matter) {
      return res.status(404).json({ success: false, message: 'Matter not found' });
    }

    await matter.destroy();
    res.json({ success: true, message: 'Matter deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting matter' });
  }
});

module.exports = router;
