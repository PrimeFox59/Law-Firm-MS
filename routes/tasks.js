const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { Task, Matter, User, Document } = require('../models');
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { getActiveHierarchyTree, getAssignableRolesForUser } = require('../utils/roleHierarchy');
const { sendNotification, notifications } = require('../utils/whatsappNotifier');
const useFirestore = process.env.FIRESTORE_ENABLED === 'true';
const fsTasks = useFirestore ? require('../services/firestore/tasks') : null;
const fsMatters = useFirestore ? require('../services/firestore/matters') : null;
const fsUsers = useFirestore ? require('../services/firestore/users') : null;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          req.flash('error', 'File too large. Max size is 20MB.');
        } else {
          req.flash('error', `Upload error: ${err.code}`);
        }
      } else {
        req.flash('error', 'Upload error. Please try again.');
      }
      return res.redirect(`/tasks/${req.params.id}`);
    }
    next();
  });
};

// List tasks
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { tab = 'all', search, status, priority, matter_id } = req.query;
    const isAdmin = req.user?.account_type === 'admin';
    const filters = { search, status, priority, matter_id };

    let approvalTasks;
    let tasks;
    let matters;

    if (useFirestore) {
      approvalTasks = await fsTasks.listApprovals({ userId: req.user.id });
      tasks = tab === 'approval'
        ? approvalTasks
        : await fsTasks.listForUser({ userId: req.user.id, isAdmin, filters });
      matters = await fsMatters.findAllForUser({ userId: req.user.id, isAdmin, search, status: 'all', dispute: 'all' });
    } else {
      const where = isAdmin ? {} : { assignee_id: req.user.id };

      if (tab === 'matter') {
        where.task_type = 'matter';
      } else if (tab === 'personal') {
        where.task_type = 'personal';
      }

      if (search) {
        where.title = { [Op.like]: `%${search}%` };
      }

      if (status) {
        where.status = status;
      }

      if (priority) {
        where.priority = priority;
      }

      if (matter_id) {
        where.matter_id = matter_id;
      }

      const approvalWhere = {
        created_by: req.user.id,
        status: { [Op.not]: 'completed' }
      };

      approvalTasks = await Task.findAll({
        where: approvalWhere,
        include: [
          { model: Matter, as: 'matter' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'account_type'] }
        ],
        order: [['updated_at', 'DESC']]
      });

      tasks = tab === 'approval'
        ? approvalTasks
        : await Task.findAll({
          where,
          include: [
            { model: Matter, as: 'matter' },
            { model: User, as: 'assignee' },
            { model: User, as: 'creator', attributes: ['id', 'full_name', 'account_type'] }
          ],
          order: [
            ['priority', 'DESC'],
            ['due_date', 'ASC']
          ]
        });

      const mattersFilter = isAdmin ? {} : {
        [Op.or]: [
          { created_by: req.user.id },
          { responsible_attorney_id: req.user.id }
        ]
      };

      matters = await Matter.findAll({ where: mattersFilter });
    }

    res.render('tasks/index', {
      title: 'Tasks',
      tasks,
      matters,
      tab,
      search: search || '',
      status: status || 'all',
      priority: priority || 'all',
      matter_id: matter_id || 'all',
      approvalTasks
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading tasks');
    res.redirect('/dashboard');
  }
});

// Add task page
router.get('/add', isAuthenticated, async (req, res) => {
  try {
    let matters;
    let users;

    if (useFirestore) {
      matters = await fsMatters.findAllForUser({ userId: req.user.id, isAdmin: req.user?.account_type === 'admin', search: '', status: 'all', dispute: 'all' });
      const tree = await getActiveHierarchyTree();
      const assignableRoles = getAssignableRolesForUser(tree, req.user.account_type, req.user?.account_type === 'admin');
      users = await fsUsers.listActive({ accountTypes: assignableRoles || undefined });
    } else {
      matters = await Matter.findAll({
        where: {
          [Op.or]: [
            { created_by: req.user.id },
            { responsible_attorney_id: req.user.id }
          ]
        }
      });

      const tree = await getActiveHierarchyTree();
      const assignableRoles = getAssignableRolesForUser(tree, req.user.account_type, req.user?.account_type === 'admin');

      users = await User.findAll({
        where: {
          is_active: true,
          ...(assignableRoles ? { account_type: { [Op.in]: assignableRoles } } : {})
        }
      });
    }

    res.render('tasks/form', {
      title: 'Add Task',
      task: null,
      matters,
      users,
      action: 'add'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading form');
    res.redirect('/tasks');
  }
});

// Task detail
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    let task;
    if (useFirestore) {
      task = await fsTasks.findById(req.params.id);
      if (task && task.matter_id) {
        task.matter = await fsMatters.findById(task.matter_id);
      }
    } else {
      task = await Task.findByPk(req.params.id, {
        include: [
          { model: Matter, as: 'matter' },
          { model: User, as: 'assignee' },
          { model: User, as: 'creator' }
        ]
      });
    }

    if (!task) {
      req.flash('error', 'Task not found');
      return res.redirect('/tasks');
    }

    const documents = useFirestore ? [] : await Document.findAll({
      where: { task_id: req.params.id, is_deleted: false },
      order: [['created_at', 'DESC']]
    });

    res.render('tasks/detail', {
      title: 'Task Detail',
      task,
      documents
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading task');
    res.redirect('/tasks');
  }
});

// Create task
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      task_type, matter_id, title, description,
      status, priority, start_date, due_date,
      assignee_id, notes, hyperlink
    } = req.body;

    const tree = await getActiveHierarchyTree();
    const assignableRoles = getAssignableRolesForUser(tree, req.user.account_type, req.user?.account_type === 'admin');

    if (assignableRoles) {
      const assignee = await User.findByPk(assignee_id, { attributes: ['id', 'account_type'] });
      if (!assignee || !assignableRoles.includes(assignee.account_type)) {
        req.flash('error', 'You can only assign tasks to roles below your hierarchy');
        return res.redirect('/tasks/add');
      }
    }

    const newTask = await Task.create({
      task_type,
      matter_id: matter_id || null,
      title,
      description,
      status,
      priority,
      start_date: start_date || null,
      due_date: due_date || null,
      assignee_id,
      notes,
      hyperlink,
      created_by: req.user.id
    });

    if (useFirestore) {
      await fsTasks.create({
        id: newTask.id,
        task_type,
        matter_id: matter_id ? String(matter_id) : null,
        title,
        description,
        status,
        priority,
        start_date: start_date || null,
        due_date: due_date || null,
        assignee_id: assignee_id ? String(assignee_id) : null,
        notes,
        hyperlink,
        created_by: req.user.id ? String(req.user.id) : null
      });
    }

    // Send notification to assignee (email)
    const assignee = await User.findByPk(assignee_id);
    if (assignee) {
      const message = notifications.taskAssigned(title, assignee.full_name, due_date);
      sendNotification({ message, user: assignee, topic: 'task_assigned', link: `/tasks/${newTask.id}` }).catch(err => console.error('Notification failed:', err));
    }

    req.flash('success', 'Task created successfully');
    res.redirect('/tasks');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating task');
    res.redirect('/tasks/add');
  }
});

// Upload document for task
router.post('/:id/documents', isAuthenticated, handleUpload, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      req.flash('error', 'Task not found');
      return res.redirect('/tasks');
    }

    if (!req.file) {
      req.flash('error', 'File is required');
      return res.redirect(`/tasks/${req.params.id}`);
    }

    await Document.create({
      name: req.file.originalname,
      type: 'file',
      parent_id: null,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      matter_id: task.matter_id || null,
      contact_id: null,
      task_id: task.id,
      created_by: req.user.id
    });

    req.flash('success', 'Document uploaded');
    res.redirect(`/tasks/${req.params.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error uploading document');
    res.redirect(`/tasks/${req.params.id}`);
  }
});

// Update task status
router.patch('/:id/status', isAuthenticated, async (req, res) => {
  try {
    let task;
    if (useFirestore) {
      task = await fsTasks.findById(req.params.id);
    } else {
      task = await Task.findByPk(req.params.id, {
        include: [
          { model: User, as: 'assignee', attributes: ['full_name', 'phone'] },
          { model: User, as: 'creator', attributes: ['full_name', 'phone'] }
        ]
      });
    }
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Only task creator can approve/change status
    if (task.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the task creator can change status' });
    }

    const oldStatus = task.status;
    if (useFirestore) {
      await fsTasks.update(task.id, { status: req.body.status });
    } else {
      await task.update({ status: req.body.status });
    }

    // Send notification if task completed (email)
    if (req.body.status === 'completed' && oldStatus !== 'completed') {
      const creator = task.creator;
      if (creator) {
        const message = notifications.taskCompleted(task.title, creator.full_name);
        sendNotification({ message, user: creator, topic: 'task_completed', link: `/tasks/${task.id}` }).catch(err => console.error('Notification failed:', err));
      }
    }

    res.json({ success: true, message: 'Task status updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating task' });
  }
});

// Delete task
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    if (useFirestore) {
      await fsTasks.remove(req.params.id);
    }

    const task = await Task.findByPk(req.params.id);
    if (task) {
      await task.destroy();
    }
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting task' });
  }
});

module.exports = router;
