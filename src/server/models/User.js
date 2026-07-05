const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const User = sequelize.define('User', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: {
      name: 'idx_email',
      msg: '该邮箱已被注册'
    },
    validate: {
      isEmail: { msg: '邮箱格式不正确' },
      notEmpty: { msg: '邮箱不能为空' }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: '密码不能为空' },
      len: { args: [6, 255], msg: '密码长度至少6位' }
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: '姓名不能为空' }
    }
  },
  avatar: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null
  },
  reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at',
  indexes: [
    {
      name: 'idx_email',
      unique: true,
      fields: ['email']
    },
    {
      name: 'idx_users_deleted',
      fields: ['deleted_at']
    }
  ]
})

module.exports = User
