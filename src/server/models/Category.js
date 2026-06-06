const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Category = sequelize.define('Category', {
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
      notEmpty: { msg: '分类名称不能为空' }
    }
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: false,
    defaultValue: '#1890ff',
    validate: {
      is: { args: /^#[0-9A-Fa-f]{6}$/, msg: '颜色格式不正确 (例: #1890ff)' }
    }
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'categories',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      name: 'idx_categories_user_id',
      fields: ['user_id']
    },
    {
      name: 'idx_categories_sort_order',
      fields: ['user_id', 'sort_order']
    }
  ]
})

module.exports = Category
