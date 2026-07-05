const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Reminder = sequelize.define('Reminder', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  target_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'time_block',
    validate: {
      isIn: {
        args: [['time_block', 'note']],
        msg: '提醒目标类型只能是 time_block 或 note'
      }
    }
  },
  target_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  remind_at: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: { msg: '提醒时间格式不正确' }
    }
  },
  advance_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: '提前提醒分钟数不能为负数' }
    }
  },
  is_auto: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  note_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null,
    comment: '关联便签ID（自动提醒时记录）'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: '提醒标题不能为空' }
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: {
        args: [['pending', 'triggered', 'dismissed', 'cancelled']],
        msg: '提醒状态无效'
      }
    }
  },
  triggered_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  dismissed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'reminders',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { name: 'idx_reminder_user', fields: ['user_id'] },
    { name: 'idx_reminder_target', fields: ['target_type', 'target_id'] },
    { name: 'idx_reminder_status', fields: ['user_id', 'status', 'remind_at'] },
    { name: 'idx_reminder_note', fields: ['note_id'] },
    { name: 'idx_reminder_auto', fields: ['is_auto'] }
  ]
})

module.exports = Reminder
