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
 *   Category    - 分类表 CRUD + 软删除/级联处理
 *   TimeBlock   - 时间块表 CRUD + 日/周/月视图 + 搜索
 *   ActiveTimer - 计时器 start/stop/pause/resume
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
const Category = require('./Category')
const TimeBlock = require('./TimeBlock')
const ActiveTimer = require('./ActiveTimer')
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
  for (const sql of SCHEMA_SQL) {
    try {
      db.run(sql)
    } catch (err) {
      console.error('[SQLite] Schema 执行失败:', sql.slice(0, 80), err.message)
    }
  }

  // 3. 保存初始状态
  connection.save()

  console.log(`[SQLite] 初始化完成: ${SCHEMA_SQL.filter(s => s.includes('CREATE TABLE')).length} 张表已就绪`)

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
  category: Category,
  timeBlock: TimeBlock,
  activeTimer: ActiveTimer,
  syncLog: SyncLog,
  statistic: Statistic
}
