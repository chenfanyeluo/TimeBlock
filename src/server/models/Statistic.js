const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Statistic = sequelize.define('Statistic', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  stat_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  category_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null,
    comment: 'NULL=全天总计行'
  },
  total_seconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  block_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'statistics',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { name: 'idx_stat_unique', unique: true, fields: ['user_id', 'stat_date', 'category_id'] },
    { name: 'idx_stat_user_date', fields: ['user_id', 'stat_date'] }
  ]
})

module.exports = Statistic
