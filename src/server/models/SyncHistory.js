const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const SyncHistory = sequelize.define('SyncHistory', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  sync_id: {
    type: DataTypes.STRING(100),
    allowNull: false
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
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  uploaded: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  downloaded: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  conflicts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'sync_history',
  underscored: true,
  timestamps: false,
  indexes: [
    {
      name: 'idx_sync_history_user_id',
      fields: ['user_id']
    },
    {
      name: 'idx_sync_history_sync_id',
      fields: ['sync_id']
    },
    {
      name: 'idx_sync_history_started_at',
      fields: ['user_id', 'started_at']
    }
  ]
})

module.exports = SyncHistory
