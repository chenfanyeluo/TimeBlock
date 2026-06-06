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
  category_id: {
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
  indexes: [
    {
      name: 'idx_timeblocks_user_id',
      fields: ['user_id']
    },
    {
      name: 'idx_timeblocks_category_id',
      fields: ['category_id']
    },
    {
      name: 'idx_timeblocks_time_range',
      fields: ['user_id', 'start_time', 'end_time']
    }
  ]
})

module.exports = TimeBlock
