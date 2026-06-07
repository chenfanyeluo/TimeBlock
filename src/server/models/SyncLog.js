const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const SyncLog = sequelize.define('SyncLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  sync_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'manual',
    validate: {
      isIn: {
        args: [['manual', 'auto']],
        msg: '同步类型无效'
      }
    }
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: {
        args: [['pending', 'in_progress', 'completed', 'failed']],
        msg: '状态值无效'
      }
    }
  },
  records_synced: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'sync_logs',
  underscored: true,
  timestamps: false,
  indexes: [
    { name: 'idx_sync_logs_user', fields: ['user_id'] },
    { name: 'idx_sync_logs_time', fields: ['user_id', 'started_at'] }
  ]
})

module.exports = SyncLog
