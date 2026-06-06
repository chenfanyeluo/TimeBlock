const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const WebdavConfig = sequelize.define('WebdavConfig', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: { name: 'idx_webdav_config_user_id', msg: '该用户已配置WebDAV' }
  },
  server_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: { msg: '服务器地址不能为空' },
      isUrl: { msg: '服务器地址格式不正确' }
    }
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: '用户名不能为空' }
    }
  },
  password: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: { msg: '密码不能为空' }
    }
  },
  last_sync_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  sync_interval: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    validate: {
      min: { args: [1], msg: '同步间隔至少1分钟' }
    }
  }
}, {
  tableName: 'webdav_config',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

module.exports = WebdavConfig
