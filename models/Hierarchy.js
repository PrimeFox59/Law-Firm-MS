const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Hierarchy = sequelize.define('Hierarchy', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]' // JSON string of tree nodes
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'hierarchies',
  underscored: true,
  timestamps: true
});

module.exports = Hierarchy;
