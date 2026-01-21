const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CostJournal = sequelize.define('CostJournal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entry_type: {
    type: DataTypes.ENUM('time', 'expense'),
    allowNull: false
  },
  matter_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'matters',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // For Time Entry
  hours: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // For Expense Entry
  expense_category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  // Common
  is_billable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_billed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  invoice_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'invoices',
      key: 'id'
    }
  }
}, {
  tableName: 'cost_journals'
});

module.exports = CostJournal;
