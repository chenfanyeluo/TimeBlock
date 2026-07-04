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
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: '软删除时间'
  }
}, {
  tableName: 'notes',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      name: 'idx_notes_user_id',
      fields: ['user_id']
    }
  ]
})

module.exports = Note