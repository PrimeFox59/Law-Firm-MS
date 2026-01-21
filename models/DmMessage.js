const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DmMessage = sequelize.define('DmMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  attachment_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  attachment_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  attachment_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'dm_messages'
});

module.exports = DmMessage;
