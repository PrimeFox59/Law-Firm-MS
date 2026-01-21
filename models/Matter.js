const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Matter = sequelize.define('Matter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  matter_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  matter_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'contacts',
      key: 'id'
    }
  },
  responsible_attorney_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  case_area: {
    type: DataTypes.STRING,
    allowNull: true
  },
  case_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dispute_resolution: {
    type: DataTypes.ENUM('litigation', 'arbitration', 'mediation', 'negotiation', 'other'),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'pending', 'closed'),
    defaultValue: 'active'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  max_budget: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'matters'
});

module.exports = Matter;
