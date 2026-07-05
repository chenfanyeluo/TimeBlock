const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Note = sequelize.define('Note', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: '便签名称不能为空' }
    }
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: false,
    defaultValue: '#409eff',
    validate: {
      is: { args: /^#[0-9A-Fa-f]{6}$/, msg: '颜色格式不正确 (例: #409eff)' }
    }
  },
  auto_remind: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否自动提醒'
  },
  default_advance_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: {
      min: { args: [0], msg: '默认提前提醒分钟数不能为负数' }
    },
    comment: '默认提前提醒分钟数'
  }
}, {
  tableName: 'notes',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at',
  indexes: [
    {
      name: 'idx_notes_user_id',
      fields: ['user_id']
    },
    {
      name: 'idx_notes_deleted',
      fields: ['deleted_at']
    },
    {
      name: 'idx_notes_auto_remind',
      fields: ['auto_remind']
    }
  ]
})

module.exports = Note