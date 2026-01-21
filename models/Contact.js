const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contact = sequelize.define('Contact', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entity_type: {
    type: DataTypes.ENUM('individual', 'company', 'other'),
    defaultValue: 'individual'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_client: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
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
  tableName: 'contacts'
});

module.exports = Contact;
