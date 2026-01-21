const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CostJournalApproval = sequelize.define('CostJournalApproval', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cost_journal_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cost_journals',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  },
  requested_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  approver_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'cost_journal_approvals',
  underscored: true
});

module.exports = CostJournalApproval;
