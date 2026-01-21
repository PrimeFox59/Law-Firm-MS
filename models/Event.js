const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  start_datetime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_datetime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  matter_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'matters',
      key: 'id'
    }
  },
  is_all_day: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  repeat_pattern: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notification_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  hyperlink: {
    type: DataTypes.STRING,
    allowNull: true
  },
  google_event_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  synced_to_google: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
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
  tableName: 'events'
});

const EventAttendee = sequelize.define('EventAttendee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
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
  response_status: {
    type: DataTypes.ENUM('accepted', 'declined', 'tentative', 'pending'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'event_attendees'
});

module.exports = { Event, EventAttendee };
