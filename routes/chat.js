const express = require('express');
const router = express.Router();
const { Op, Sequelize } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const { sequelize, User, DmMessage, Matter, Contact } = require('../models');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Chat home
router.get('/', isAuthenticated, async (req, res) => {
  const q = (req.query.q || '').trim();
  const peerId = Number(req.query.peer_id) || null;
  const userId = Number(req.user.id) || 0;
  const isAdmin = req.user?.account_type === 'admin';
  const where = {
    is_active: true,
    id: { [Op.ne]: req.user.id },
    ...(q ? { full_name: { [Op.like]: `%${q}%` } } : {})
  };

  // Use table alias "User" to avoid SQLite unknown column error
  const lastDmLiteral = sequelize.literal(`(
    SELECT COALESCE(MAX(created_at), '1970-01-01')
    FROM dm_messages dm
    WHERE (dm.sender_id = "User"."id" AND dm.receiver_id = ${userId})
       OR (dm.sender_id = ${userId} AND dm.receiver_id = "User"."id")
  )`);

  const peers = await User.findAll({
    where,
    attributes: [
      'id',
      'full_name',
      'account_type',
      'avatar',
      'email',
      [lastDmLiteral, 'last_dm_at']
    ],
    order: [[Sequelize.literal('last_dm_at'), 'DESC'], ['full_name', 'ASC']]
  });

  const matterFilters = [];
  if (!isAdmin) {
    matterFilters.push({
      [Op.or]: [
        { created_by: userId },
        { responsible_attorney_id: userId },
        Sequelize.literal(`EXISTS (SELECT 1 FROM matter_attorneys ma WHERE ma.matter_id = Matter.id AND ma.user_id = ${userId})`)
      ]
    });
  }

  const matters = await Matter.findAll({
    where: matterFilters.length ? { [Op.and]: matterFilters } : {},
    attributes: ['id', 'matter_name', 'matter_number', 'status', 'created_at'],
    include: [{ model: Contact, as: 'client', attributes: ['name'] }],
    order: [['created_at', 'DESC']],
    limit: 200
  });

  const unreadRows = await DmMessage.findAll({
    where: {
      receiver_id: req.user.id,
      read_at: { [Op.is]: null }
    },
    attributes: ['sender_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['sender_id']
  });
  const unreadMap = unreadRows.reduce((acc, row) => {
    acc[row.sender_id] = Number(row.get('count')) || 0;
    return acc;
  }, {});

  res.render('chat/index', {
    title: 'Chat',
    peers,
    q,
    peerId,
    matters,
    unreadMap
  });
});

// Fetch conversation messages (paginated + search)
router.get('/messages', isAuthenticated, async (req, res) => {
  const peerId = Number(req.query.peer_id) || 0;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 20));
  const search = (req.query.search || '').trim();

  if (!peerId || peerId === req.user.id) {
    return res.status(400).json({ success: false, message: 'peer_id is required' });
  }

  const peer = await User.findByPk(peerId, { attributes: ['id', 'full_name', 'avatar', 'account_type'] });
  if (!peer) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const where = {
    [Op.or]: [
      { sender_id: req.user.id, receiver_id: peerId },
      { sender_id: peerId, receiver_id: req.user.id }
    ],
    ...(search ? { message: { [Op.like]: `%${search}%` } } : {})
  };

  const total = await DmMessage.count({ where });
  const messages = await DmMessage.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    include: [
      { model: User, as: 'sender', attributes: ['id', 'full_name', 'account_type', 'avatar'] },
      { model: User, as: 'receiver', attributes: ['id', 'full_name', 'account_type', 'avatar'] }
    ]
  });

  // mark as read for messages received by current user
  await DmMessage.update({ read_at: new Date() }, {
    where: {
      sender_id: peerId,
      receiver_id: req.user.id,
      read_at: { [Op.is]: null }
    }
  });

  const serialized = messages.reverse().map(m => ({
    id: m.id,
    message: m.message,
    sender: m.sender,
    receiver: m.receiver,
    created_at: m.created_at || m.createdAt,
    attachment_path: m.attachment_path,
    attachment_name: m.attachment_name,
    attachment_type: m.attachment_type
  }));

  return res.json({
    success: true,
    messages: serialized,
    pagination: {
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total
    },
    peer: {
      id: peer.id,
      full_name: peer.full_name,
      account_type: peer.account_type,
      avatar: peer.avatar
    }
  });
});

// Send a DM
router.post('/send', isAuthenticated, upload.single('attachment'), async (req, res) => {
  const peerId = Number(req.body.peer_id) || 0;
  const text = (req.body.message || '').trim();
  const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
  const fileName = req.file ? req.file.originalname : null;
  const fileType = req.file ? req.file.mimetype : null;

  if (!peerId || peerId === req.user.id) {
    return res.status(400).json({ success: false, message: 'peer_id is required' });
  }
  if (!text && !filePath) {
    return res.status(400).json({ success: false, message: 'Message or attachment is required' });
  }

  const peer = await User.findByPk(peerId, { attributes: ['id', 'full_name', 'account_type', 'avatar'] });
  if (!peer) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const created = await DmMessage.create({
    sender_id: req.user.id,
    receiver_id: peerId,
    message: text || (fileName ? `Sent an attachment: ${fileName}` : ''),
    attachment_path: filePath,
    attachment_name: fileName,
    attachment_type: fileType
  });

  const message = await DmMessage.findByPk(created.id, {
    include: [
      { model: User, as: 'sender', attributes: ['id', 'full_name', 'account_type', 'avatar'] },
      { model: User, as: 'receiver', attributes: ['id', 'full_name', 'account_type', 'avatar'] }
    ]
  });

  const payload = {
    id: message.id,
    message: message.message,
    sender: message.sender,
    receiver: message.receiver,
    created_at: message.created_at || message.createdAt,
    attachment_path: message.attachment_path,
    attachment_name: message.attachment_name,
    attachment_type: message.attachment_type
  };

  const io = req.app.get('io');
  if (io) {
    io.to(`user:${req.user.id}`).emit('dm:new', payload);
    io.to(`user:${peerId}`).emit('dm:new', payload);
  }

  return res.json({ success: true, message: payload });
});

// Mark messages as read
router.post('/read', isAuthenticated, async (req, res) => {
  const peerId = Number(req.body.peer_id) || 0;
  if (!peerId || peerId === req.user.id) {
    return res.status(400).json({ success: false, message: 'peer_id is required' });
  }

  await DmMessage.update({ read_at: new Date() }, {
    where: {
      sender_id: peerId,
      receiver_id: req.user.id,
      read_at: { [Op.is]: null }
    }
  });

  return res.json({ success: true });
});

module.exports = router;
