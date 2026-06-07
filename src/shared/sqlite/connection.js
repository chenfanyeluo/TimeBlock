/**
 * SQLite 数据库连接管理模块
 *
 * 基于 sql.js (WASM SQLite) 实现本地数据库连接
 * - 纯 JavaScript 实现，无需原生编译
 * - 适用于 Electron 主进程和 Node.js 环境
 * - 支持持久化存储到文件系统
 *
 * @module sqlite/connection
 */

const path = require('path')
const fs = require('fs')

// 动态解析 sql.js 路径（兼容从不同目录调用）
// sql.js 安装在 server/node_modules，需显式指定路径
let initSqlJs
try {
  initSqlJs = require('sql.js')
} catch (_) {
  const sqlJsPath = path.join(__dirname, '..', '..', 'server', 'node_modules', 'sql.js')
  try {
    initSqlJs = require(sqlJsPath)
  } catch (e) {
    throw new Error(
      '[SQLite] 找不到 sql.js 模块。请在项目根目录执行: npm install sql.js\n' +
      '安装位置: src/server/node_modules/sql.js'
    )
  }
}

/** @type {import('sql.js').Database|null} */
let db = null

/** 当前数据库文件路径（init 时确定，save 时使用） */
let currentDbPath = null

/** 是否已初始化 */
let initialized = false

/**
 * 初始化数据库连接
 *
 * @param {Object} [options] 配置选项
 * @param {string} [options.dbPath] 数据库文件路径
 * @param {boolean} [options.forceCreate] 强制重建数据库
 * @returns {Promise<import('sql.js').Database>} 数据库实例
 */
async function init(options = {}) {
  if (db && initialized) {
    return db
  }

  currentDbPath = options.dbPath || path.join(__dirname, '..', '..', 'server', 'data', 'timeblock_local.db')
  const dbDir = path.dirname(currentDbPath)

  // 确保数据目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // 加载 sql.js WASM（定位 WASM 文件的绝对路径）
  let sqlJsDistPath
  try {
    sqlJsDistPath = path.dirname(require.resolve('sql.js/package.json'))
  } catch (_) {
    sqlJsDistPath = path.join(__dirname, '..', '..', 'server', 'node_modules', 'sql.js', 'dist')
  }
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlJsDistPath, file)
  })

  // 尝试加载已有数据库文件，或创建新数据库
  if (fs.existsSync(currentDbPath) && !options.forceCreate) {
    const fileBuffer = fs.readFileSync(currentDbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON;')

  // 启用 WAL 模式提升并发性能
  db.run('PRAGMA journal_mode = WAL;')

  // 性能优化设置
  db.run('PRAGMA synchronous = NORMAL;')
  db.run('PRAGMA cache_size = -10000;') // 10MB 缓存

  initialized = true
  console.log('[SQLite] 数据库连接成功:', currentDbPath)

  return db
}

/**
 * 获取当前数据库实例
 * @returns {import('sql.js').Database}
 */
function getDB() {
  if (!db || !initialized) {
    throw new Error('[SQLite] 数据库未初始化，请先调用 init()')
  }
  return db
}

/**
 * 将数据库保存到磁盘（持久化）
 * 使用 init() 时确定的路径，确保持久化到正确位置
 */
function save() {
  if (!db || !initialized || !currentDbPath) return

  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(currentDbPath, buffer)
}

/**
 * 关闭数据库连接
 */
function close() {
  if (db) {
    save()
    db.close()
    db = null
    currentDbPath = null
    initialized = false
    console.log('[SQLite] 数据库连接已关闭')
  }
}

/**
 * 执行 SQL 并返回结果对象
 * 对于 SELECT 返回多行，对于其他语句执行后返回元信息
 *
 * @param {string} sql SQL 语句
 * @param {(string|number|Buffer|null)[]} [params] 参数绑定
 * @param {boolean} [shouldSave=true] 是否自动持久化
 * @returns {{ columns: string[], values: any[][] }}
 */
function run(sql, params = [], shouldSave = true) {
  const database = getDB()
  const stmt = database.prepare(sql)

  try {
    if (params && params.length > 0) {
      stmt.bind(params)
    }
    stmt.step()

    const result = {
      columns: stmt.getColumnNames(),
      values: []
    }

    // 如果是 SELECT 查询，收集所有行
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      stmt.reset()
      if (params && params.length > 0) {
        stmt.bind(params)
      }
      while (stmt.step()) {
        result.values.push(stmt.get())
      }
    }

    stmt.free()

    if (shouldSave) {
      save()
    }

    return result
  } catch (err) {
    stmt.free()
    throw err
  }
}

/**
 * 执行查询返回对象数组
 *
 * @param {string} sql SQL 语句
 * @param {(string|number|Buffer|null)[]} [params] 参数
 * @returns {Object[]}
 */
function all(sql, params = []) {
  const result = run(sql, params, false)
  if (!result.columns || result.columns.length === 0) return []

  return result.values.map((row) => {
    const obj = {}
    result.columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })
}

/**
 * 执行查询返回单行对象
 *
 * @param {string} sql SQL 语句
 * @param {(string|number|Buffer|null)[]} [params] 参数
 * @returns {Object|null}
 */
function get(sql, params = []) {
  const rows = all(sql, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * 执行写入操作（INSERT/UPDATE/DELETE），返回受影响行数和最后插入ID
 *
 * @param {string} sql SQL 语句
 * @param {(string|number|Buffer|null)[]} [params] 参数
 * @returns {{ lastInsertRowid: number, changes: number }}
 */
function exec(sql, params = []) {
  const database = getDB()
  database.run(sql, params)

  // 使用 prepare + step 获取值，避免 db.exec 干扰外层事务
  let lastInsertRowid = null
  let changes = 0

  try {
    const stmt = database.prepare('SELECT last_insert_rowid();')
    stmt.step()
    lastInsertRowid = stmt.get()[0]
    stmt.free()
  } catch (_) { /* 某些情况下可能不可用 */ }

  try {
    const stmt = database.prepare('SELECT changes();')
    stmt.step()
    changes = stmt.get()[0]
    stmt.free()
  } catch (_) { /* 某些情况下可能不可用 */ }

  const result = {
    lastInsertRowid: lastInsertRowid ?? null,
    changes: changes ?? 0
  }
  save()
  return result
}

/**
 * 在事务中执行多个操作
 *
 * @param {Function} fn 事务回调函数，接收 db 作为参数
 * @returns {*} fn 的返回值
 */
function transaction(fn) {
  const database = getDB()
  database.run('BEGIN TRANSACTION;')

  try {
    const result = fn(database)
    database.run('COMMIT;')
    save()
    return result
  } catch (err) {
    try { database.run('ROLLBACK;'); } catch (_) { /* 忽略 */ }
    throw err
  }
}

/**
 * 事务内安全执行写入操作（不调用 save()，由外层事务统一保存）
 * 仅在 transaction() 回调内部使用！
 *
 * @param {import('sql.js').Database} database 数据库实例（由 transaction 传入）
 * @param {string} sql SQL 语句
 * @param {(string|number|Buffer|null)[]} [params] 参数
 * @returns {{ lastInsertRowid: number, changes: number }}
 */
function execInTx(database, sql, params = []) {
  database.run(sql, params)

  let lastInsertRowid = null
  let changes = 0

  try {
    const stmt = database.prepare('SELECT last_insert_rowid();')
    stmt.step()
    lastInsertRowid = stmt.get()[0]
    stmt.free()
  } catch (_) {}

  try {
    const stmt = database.prepare('SELECT changes();')
    stmt.step()
    changes = stmt.get()[0]
    stmt.free()
  } catch (_) {}

  return {
    lastInsertRowid: lastInsertRowid ?? null,
    changes: changes ?? 0
  }
}

module.exports = {
  init,
  getDB,
  save,
  close,
  run,
  all,
  get,
  exec,
  execInTx,
  transaction
}
