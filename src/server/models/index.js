const User = require('./User')
const Category = require('./Category')
const TimeBlock = require('./TimeBlock')
const WebdavConfig = require('./WebdavConfig')
const SyncHistory = require('./SyncHistory')

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

// User ↔ WebdavConfig (一对一)
User.hasOne(WebdavConfig, {
  foreignKey: 'user_id',
  as: 'webdavConfig',
  onDelete: 'CASCADE'
})
WebdavConfig.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// User ↔ SyncHistory (一对多)
User.hasMany(SyncHistory, {
  foreignKey: 'user_id',
  as: 'syncHistories',
  onDelete: 'CASCADE'
})
SyncHistory.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

module.exports = {
  User,
  Category,
  TimeBlock,
  WebdavConfig,
  SyncHistory
}
