const User = require('./User')
const Note = require('./Note')
const TimeBlock = require('./TimeBlock')
const SyncLog = require('./SyncLog')
const Statistic = require('./Statistic')

// =============================================
// 模型关联关系
// =============================================

// User  Note (一对多)
User.hasMany(Note, {
  foreignKey: 'user_id',
  as: 'notes',
  onDelete: 'CASCADE'
})
Note.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// User  TimeBlock (一对多)
User.hasMany(TimeBlock, {
  foreignKey: 'user_id',
  as: 'timeBlocks',
  onDelete: 'CASCADE'
})
TimeBlock.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// Note  TimeBlock (一对多)
Note.hasMany(TimeBlock, {
  foreignKey: 'note_id',
  as: 'timeBlocks',
  onDelete: 'SET NULL'
})
TimeBlock.belongsTo(Note, {
  foreignKey: 'note_id',
  as: 'note'
})

// User  SyncLog (一对多)
User.hasMany(SyncLog, {
  foreignKey: 'user_id',
  as: 'syncLogs',
  onDelete: 'CASCADE'
})
SyncLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// User  Statistic (一对多)
User.hasMany(Statistic, {
  foreignKey: 'user_id',
  as: 'statistics',
  onDelete: 'CASCADE'
})
Statistic.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

// Note  Statistic (一对多, 可选)
Note.hasMany(Statistic, {
  foreignKey: 'note_id',
  as: 'statistics',
  onDelete: 'SET NULL'
})
Statistic.belongsTo(Note, {
  foreignKey: 'note_id',
  as: 'note'
})

module.exports = {
  User,
  Note,
  TimeBlock,
  SyncLog,
  Statistic
}