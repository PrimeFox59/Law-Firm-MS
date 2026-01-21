const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ContactEmail = sequelize.define('ContactEmail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contact_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'contacts',
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  email_type: {
    type: DataTypes.STRING,
    defaultValue: 'personal'
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'contact_emails'
});

const ContactPhone = sequelize.define('ContactPhone', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contact_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'contacts',
      key: 'id'
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone_type: {
    type: DataTypes.STRING,
    defaultValue: 'mobile'
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'contact_phones'
});

const ContactAddress = sequelize.define('ContactAddress', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contact_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'contacts',
      key: 'id'
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  address_type: {
    type: DataTypes.STRING,
    defaultValue: 'home'
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'contact_addresses'
});

module.exports = { ContactEmail, ContactPhone, ContactAddress };
