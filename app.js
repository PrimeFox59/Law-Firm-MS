require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('./config/passport');
const path = require('path');
const methodOverride = require('method-override');
const http = require('http');
const { Server } = require('socket.io');
const { DataTypes } = require('sequelize');
const { sequelize, Task, Invoice, Matter, Contact } = require('./models');
const { Op } = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Bind to IPv6 unspecified to accept both IPv6 (::1/localhost) and IPv4 (127.0.0.1) unless HOST is explicitly set
const HOST = process.env.HOST || '::';
const PORT = process.env.PORT || 3000;

// Session configuration
const sessionStore = new SequelizeStore({ db: sequelize });
sessionStore.sync();

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
});

app.use(sessionMiddleware);

// Flash messages
app.use(flash());

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Global variables for views
app.use(async (req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.notifications = [];
  res.locals.notifCount = 0;

  if (!req.user) return next();

  try {
    const userId = req.user.id;

    const approvalTasks = await Task.findAll({
      where: {
        created_by: userId,
        status: { [Op.not]: 'completed' }
      },
      include: [{ model: Matter, as: 'matter' }],
      order: [['updated_at', 'DESC']],
      limit: 5
    });

    const today = new Date();
    const unpaidInvoices = await Invoice.findAll({
      where: {
        created_by: userId,
        [Op.or]: [
          { status: { [Op.in]: ['overdue', 'partial'] } },
          { status: 'sent', due_date: { [Op.lt]: today } }
        ]
      },
      include: [{ model: Contact, as: 'contact' }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    const notifications = [];

    approvalTasks.forEach(t => {
      notifications.push({
        type: 'approval',
        title: 'Task needs approval',
        subtitle: t.title,
        meta: t.matter ? t.matter.matter_name : 'No matter',
        link: `/tasks/${t.id}`
      });
    });

    unpaidInvoices.forEach(inv => {
      notifications.push({
        type: 'invoice',
        title: 'Invoice unpaid',
        subtitle: inv.invoice_number,
        meta: inv.contact ? inv.contact.name : 'Unknown client',
        link: `/invoices/${inv.id}`
      });
    });

    res.locals.notifications = notifications;
    res.locals.notifCount = notifications.length;
  } catch (err) {
    console.error('Notification preload error', err);
  }

  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/contacts', require('./routes/contacts'));
app.use('/calendar', require('./routes/calendar'));
app.use('/matters', require('./routes/matters'));
app.use('/tasks', require('./routes/tasks'));
app.use('/documents', require('./routes/documents'));
app.use('/cost-journal', require('./routes/cost-journal'));
app.use('/invoices', require('./routes/invoices'));
app.use('/transactions', require('./routes/transactions'));
app.use('/settings', require('./routes/settings'));
app.use('/users', require('./routes/users'));
app.use('/chat', require('./routes/chat'));
app.use('/timer', require('./routes/timer'));

// Simple health check for connectivity validation
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use((req, res, next) => {
  res.status(404).render('errors/404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', { 
    title: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Socket.io setup with shared session + passport
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const wrap = middleware => (socket, next) => middleware(socket.request, socket.request.res || {}, next);
io.engine.use(sessionMiddleware);
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.on('connection', (socket) => {
  const user = socket.request.user;
  if (!user) {
    socket.disconnect(true);
    return;
  }

  // Join personal room for DM/notifications
  socket.join(`user:${user.id}`);

  socket.on('join_matter', (matterId) => {
    if (!matterId) return;
    socket.join(`matter:${matterId}`);
  });

  socket.on('join_user', (userId) => {
    if (Number(userId) === Number(user.id)) {
      socket.join(`user:${user.id}`);
    }
  });
});

app.set('io', io);

// Database sync and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Ensure new columns exist without altering unrelated schema
    const ensureSchema = async () => {
      const qi = sequelize.getQueryInterface();

      const safeDescribe = async (table) => {
        try {
          return await qi.describeTable(table);
        } catch (err) {
          // Table might not exist yet (fresh DB). Sync will create it below.
          return null;
        }
      };

      // Documents safety
      const documents = await safeDescribe('documents');
      if (documents) {
        if (!documents.task_id) {
          await qi.addColumn('documents', 'task_id', {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'tasks', key: 'id' }
          });
          console.log('Added documents.task_id');
        }
        if (!documents.revision_number) {
          await qi.addColumn('documents', 'revision_number', {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
          });
          console.log('Added documents.revision_number');
        }
      }

      // Users safety (Google OAuth + notifications)
      const users = await safeDescribe('users');
      const ensureUserColumn = async (column, definition) => {
        if (users && !users[column]) {
          await qi.addColumn('users', column, definition);
          console.log(`Added users.${column}`);
        }
      };

      await ensureUserColumn('google_id', {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
      });

      await ensureUserColumn('google_access_token', {
        type: DataTypes.TEXT,
        allowNull: true
      });

      await ensureUserColumn('google_refresh_token', {
        type: DataTypes.TEXT,
        allowNull: true
      });

      await ensureUserColumn('google_token_expiry', {
        type: DataTypes.DATE,
        allowNull: true
      });

      await ensureUserColumn('google_connected', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });

      await ensureUserColumn('last_login', {
        type: DataTypes.DATE,
        allowNull: true
      });

      await ensureUserColumn('notify_task_assigned', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_task_completed', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_task_deadline', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_approval_request', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_approval_result', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_invoice', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_payment', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('notify_matter', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });

      // Email-specific notification preferences
      await ensureUserColumn('email_task_assigned', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('email_task_due_soon', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('email_task_overdue', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('email_task_completed', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('email_approval_request', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      await ensureUserColumn('email_approval_result', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });

      await ensureUserColumn('timer_running', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      await ensureUserColumn('timer_started_at', {
        type: DataTypes.DATE,
        allowNull: true
      });
      await ensureUserColumn('timer_elapsed_ms', {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      });

      // DM messages attachments
      const dmMessages = await safeDescribe('dm_messages');
      const ensureDmColumn = async (column, definition) => {
        if (dmMessages && !dmMessages[column]) {
          await qi.addColumn('dm_messages', column, definition);
          console.log(`Added dm_messages.${column}`);
        }
      };

      await ensureDmColumn('attachment_path', {
        type: DataTypes.STRING,
        allowNull: true
      });
      await ensureDmColumn('attachment_name', {
        type: DataTypes.STRING,
        allowNull: true
      });
      await ensureDmColumn('attachment_type', {
        type: DataTypes.STRING,
        allowNull: true
      });
      await ensureDmColumn('read_at', {
        type: DataTypes.DATE,
        allowNull: true
      });
    };

    await ensureSchema();

    // Sync database; avoid ALTER in sqlite to prevent FK drop errors
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync();
      console.log('Database synchronized');
    }

    // Start server
    const displayHost = HOST === '::' ? 'localhost' : HOST;
    server.listen(PORT, HOST, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       Law Firm Management System                          ║
║                                                           ║
  ║       Server running on: http://${displayHost}:${PORT}        ║
║       Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
║       Press Ctrl+C to stop the server                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
