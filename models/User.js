const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true // Nullable for Google OAuth users
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  company: {
    type: DataTypes.STRING,
    allowNull: true
  },
  account_type: {
    type: DataTypes.STRING,
    defaultValue: 'staff'
  },
  hourly_rate: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'en'
  },
  theme: {
    type: DataTypes.STRING,
    defaultValue: 'light'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  google_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  google_access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  google_refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  google_token_expiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  google_connected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Notification preferences
  notify_task_assigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_task_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_task_deadline: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_approval_request: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_approval_result: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_invoice: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_payment: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notify_matter: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Email-specific notification preferences
  email_task_assigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_task_due_soon: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_task_overdue: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_task_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_approval_request: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_approval_result: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Timer state (shared across devices)
  timer_running: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  timer_started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  timer_elapsed_ms: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  }
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.validatePassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
