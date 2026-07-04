const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const TimeBlock = sequelize.define('TimeBlock', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  note_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: '时间块标题不能为空' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: { msg: '开始时间格式不正确' }
    }
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: { msg: '结束时间格式不正确' },
      isAfterStart(value) {
        if (this.start_time && new Date(value) <= new Date(this.start_time)) {
          throw new Error('结束时间必须晚于开始时间')
        }
      }
    }
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'time_blocks',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at',
  indexes: [
    {
      name: 'idx_timeblocks_user_id',
      fields: ['user_id']
    },
    {
      // 联合索引，替代原单列 note_id 索引，实现租户隔离
      name: 'idx_user_note',
      fields: ['user_id', 'note_id']
    },
    {
      name: 'idx_time_range',
      fields: ['user_id', 'start_time', 'end_time']
    },
    {
      // 日视图覆盖索引，减少回表
      name: 'idx_user_date_covering',
      fields: ['user_id', 'deleted_at', 'start_time', 'end_time', 'note_id', 'title', 'is_completed']
    },
    {
      name: 'idx_timeblocks_deleted',
      fields: ['deleted_at']
    }
    // 注意：FULLTEXT 索引 ft_title_desc(title, description) 为 MySQL 专用，
    // 由 database/init.sql 管理，Sequelize 模型层不创建，避免 SQLite 不兼容。
  ]
})

module.exports = TimeBlock
