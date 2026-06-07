const User = require('./User')
const Category = require('./Category')
const TimeBlock = require('./TimeBlock')
const SyncLog = require('./SyncLog')
const Statistic = require('./Statistic')

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

// User ↔ SyncLog (一对多)
User.hasMany(SyncLog, {
  foreignKey: 'user_id',
  as: 'syncLogs',
  onDelete: 'CASCADE'
})
SyncLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// User ↔ Statistic (一对多)
User.hasMany(Statistic, {
  foreignKey: 'user_id',
  as: 'statistics',
  onDelete: 'CASCADE'
})
Statistic.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// Category ↔ Statistic (一对多, 可选)
Category.hasMany(Statistic, {
  foreignKey: 'category_id',
  as: 'statistics',
  onDelete: 'SET NULL'
})
Statistic.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category'
})

module.exports = {
  User,
  Category,
  TimeBlock,
  SyncLog,
  Statistic
}
