const User = require('./User')
const Category = require('./Category')
const TimeBlock = require('./TimeBlock')

// =============================================
// 模型关联关系
// =============================================

// User ↔ Category (一对多)
User.hasMany(Category, {
  foreignKey: 'user_id',
  as: 'categories',
  onDelete: 'CASCADE'
})
Category.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// User ↔ TimeBlock (一对多)
User.hasMany(TimeBlock, {
  foreignKey: 'user_id',
  as: 'timeBlocks',
  onDelete: 'CASCADE'
})
TimeBlock.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// Category ↔ TimeBlock (一对多)
Category.hasMany(TimeBlock, {
  foreignKey: 'category_id',
  as: 'timeBlocks',
  onDelete: 'SET NULL'
})
TimeBlock.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category'
})

module.exports = {
  User,
  Category,
  TimeBlock
}
