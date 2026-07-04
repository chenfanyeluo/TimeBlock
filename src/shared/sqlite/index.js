/**
 * SQLite 本地数据库模块 - 主入口
 *
 * TimeBlock Electron 桌面端本地数据存储层
 *
 * 功能概览:
 * - 基于 sql.js (WASM SQLite) 的纯 JavaScript 实现
 * - 无需原生编译，跨平台兼容（Windows/macOS/Linux）
 * - 与服务端 MySQL 表结构完全对齐
 * - 支持离线使用 + 数据同步到云端 MySQL
 *
 * 模块组成:
 *   connection  - 数据库连接管理（初始化/持久化/事务）
 *   schema      - 建表 DDL（6张表 + 索引）
 *   User        - 用户表 CRUD + 认证
 *   Note        - 便签表 CRUD + 软删除/级联处理
 *   TimeBlock   - 时间块表 CRUD + 日/周/月视图 + 搜索
 *   Reminder    - 提醒通知 CRUD + 定时触发检查
 *   SyncLog     - 同步日志记录
 *   Statistic   - 统计汇总预计算
 *
 * 使用方式:
 *   const sqlite = require('./shared/sqlite')
 *   await sqlite.init()                    // 初始化数据库
 *   const user = sqlite.user.create({...})  // 创建用户
 *   await sqlite.close()                   // 关闭时调用
 *
 * @module sqlite
 */

const connection = require('./connection')
const SCHEMA_SQL = require('./schema')

const User = require('./User')
const Note = require('./Note')
const TimeBlock = require('./TimeBlock')
const Reminder = require('./Reminder')
const SyncLog = require('./SyncLog')
const Statistic = require('./Statistic')

/**
 * 初始化 SQLite 数据库
 *
 * 自动完成:
 * 1. 加载 sql.js WASM 引擎
 * 2. 打开/创建数据库文件
 * 3. 执行建表 SQL（幂等，IF NOT EXISTS）
 * 4. 配置性能优化 PRAGMA
 *
 * @param {Object} [options] 配置选项
 * @param {string} [options.dbPath] 数据库文件路径
 * @param {boolean} [options.forceCreate] 强制重建数据库
 * @returns {Promise<import('sql.js').Database>} 数据库实例
 */
async function init(options = {}) {
  // 1. 初始化数据库连接
  const db = await connection.init(options)

  // 2. 建表（所有 CREATE TABLE IF NOT EXISTS，幂等执行）
  console.log('[SQLite] 开始执行建表语句...')
  let tableCount = 0
  let indexCount = 0

  for (const sql of SCHEMA_SQL) {
    try {
      db.run(sql)

      // 统计创建的表和索引
      if (sql.includes('CREATE TABLE')) {
        tableCount++
        const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown'
        console.log(`[SQLite] ✓ 表已创建: ${tableName}`)
      } else if (sql.includes('CREATE INDEX') || sql.includes('CREATE UNIQUE INDEX')) {
        indexCount++
        const indexName = sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/)?.[1] || 'unknown'
        console.log(`[SQLite] ✓ 索引已创建: ${indexName}`)
      }
    } catch (err) {
      // CREATE TABLE IF NOT EXISTS 重复执行通常不会报错
      // 如果报错,说明可能是严重的数据库问题
      console.error('[SQLite] Schema 执行失败:', sql.slice(0, 80), err.message)

      // 如果是关键表(users/notes/time_blocks/reminders)创建失败,抛出错误
      if (sql.includes('CREATE TABLE IF NOT EXISTS users') ||
          sql.includes('CREATE TABLE IF NOT EXISTS notes') ||
          sql.includes('CREATE TABLE IF NOT EXISTS time_blocks') ||
          sql.includes('CREATE TABLE IF NOT EXISTS reminders')) {
        throw new Error(`关键表创建失败: ${err.message}`)
      }
    }
  }

  // 3. 数据库迁移:为旧表添加缺失的字段
  console.log('[SQLite] 开始数据库迁移...')

  try {
    // 检查 notes 表是否有 auto_remind 字段
    const notesColumns = db.exec("PRAGMA table_info(notes);")[0]?.values || []
    const notesColumnNames = notesColumns.map(col => col[1])

    if (!notesColumnNames.includes('auto_remind')) {
      console.log('[SQLite] notes 表缺少 auto_remind 字段,正在添加...')
      db.run(`ALTER TABLE notes ADD COLUMN auto_remind INTEGER NOT NULL DEFAULT 0 CHECK(auto_remind IN (0, 1));`)
      console.log('[SQLite] ✓ notes.auto_remind 字段已添加')
    }

    if (!notesColumnNames.includes('default_advance_minutes')) {
      console.log('[SQLite] notes 表缺少 default_advance_minutes 字段,正在添加...')
      db.run(`ALTER TABLE notes ADD COLUMN default_advance_minutes INTEGER NOT NULL DEFAULT 5;`)
      console.log('[SQLite] ✓ notes.default_advance_minutes 字段已添加')
    }

    // 检查 reminders 表是否有 is_auto 字段
    const remindersColumns = db.exec("PRAGMA table_info(reminders);")[0]?.values || []
    const remindersColumnNames = remindersColumns.map(col => col[1])

    if (!remindersColumnNames.includes('is_auto')) {
      console.log('[SQLite] reminders 表缺少 is_auto 字段,正在添加...')
      db.run(`ALTER TABLE reminders ADD COLUMN is_auto INTEGER NOT NULL DEFAULT 0 CHECK(is_auto IN (0, 1));`)
      console.log('[SQLite] ✓ reminders.is_auto 字段已添加')
    }

    if (!remindersColumnNames.includes('note_id')) {
      console.log('[SQLite] reminders 表缺少 note_id 字段,正在添加...')
      db.run(`ALTER TABLE reminders ADD COLUMN note_id INTEGER NULL DEFAULT NULL;`)
      console.log('[SQLite] ✓ reminders.note_id 字段已添加')
    }

    if (!remindersColumnNames.includes('advance_minutes')) {
      console.log('[SQLite] reminders 表缺少 advance_minutes 字段,正在添加...')
      db.run(`ALTER TABLE reminders ADD COLUMN advance_minutes INTEGER NOT NULL DEFAULT 0;`)
      console.log('[SQLite] ✓ reminders.advance_minutes 字段已添加')
    }

    console.log('[SQLite] ✓ 数据库迁移完成')
  } catch (err) {
    console.error('[SQLite] 数据库迁移失败:', err.message)
    // 迁移失败不应该阻止应用启动
  }

  // 4. 保存初始状态
  connection.save()

  console.log(`[SQLite] 初始化完成: ${tableCount} 张表, ${indexCount} 个索引已就绪`)

  return db
}

/**
 * 导出所有模块
 */
module.exports = {
  // 核心方法
  init,
  close: connection.close,
  save: connection.save,

  // 连接工具
  db: connection.getDB,
  run: connection.run,
  all: connection.all,
  get: connection.get,
  exec: connection.exec,
  transaction: connection.transaction,

  // 数据模型
  user: User,
  note: Note,
  timeBlock: TimeBlock,
  reminder: Reminder,
  syncLog: SyncLog,
  statistic: Statistic
}
