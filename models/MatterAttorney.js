const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MatterAttorney = sequelize.define('MatterAttorney', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  matter_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'matter_attorneys'
});

module.exports = MatterAttorney;
