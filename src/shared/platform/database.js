/**
 * 数据库适配层
 *
 * 统一封装数据库操作API：
 * - Electron: sql.js (WASM SQLite) 通过 IPC 调用
 * - Capacitor: @capacitor-community/sqlite 插件
 *
 * 保持现有 SQL 模型不变，只替换连接层
 *
 * @module shared/platform/database
 */

import { CapacitorSQLite } from '@capacitor-community/sqlite'
import { isElectron, isCapacitor } from './index'

// 数据库连接状态
let isInitialized = false

// 默认用户 ID（本地单用户模式）
const DEFAULT_USER_ID = 1

// 数据库名称（Capacitor SQLite 必需参数）
const DATABASE_NAME = 'timeblock_local'

// SQLite Schema SQL（前端版，单条语句格式）
// ⚠️ Capacitor SQLite execute() 只接受单条纯 SQL，不能有注释或多语句
const SCHEMA_SQL = [
  // users 用户表
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email VARCHAR(255) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL, avatar VARCHAR(500) NULL DEFAULT NULL, created_at DATETIME NOT NULL DEFAULT (datetime('now')), updated_at DATETIME NOT NULL DEFAULT (datetime('now')), deleted_at DATETIME NULL DEFAULT NULL)`,
  
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_email ON users(email)`,
  
  // notes 便签表
  `CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name VARCHAR(100) NOT NULL, color VARCHAR(7) NOT NULL DEFAULT '#409eff', created_at DATETIME NOT NULL DEFAULT (datetime('now')), updated_at DATETIME NOT NULL DEFAULT (datetime('now')), deleted_at DATETIME NULL DEFAULT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
  
  `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)`,
  
  // time_blocks 时间块表
  `CREATE TABLE IF NOT EXISTS time_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, note_id INTEGER NULL DEFAULT NULL, title VARCHAR(200) NOT NULL, description TEXT NULL DEFAULT NULL, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL, is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0, 1)), created_at DATETIME NOT NULL DEFAULT (datetime('now')), updated_at DATETIME NOT NULL DEFAULT (datetime('now')), deleted_at DATETIME NULL DEFAULT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL)`,
  
  `CREATE INDEX IF NOT EXISTS idx_timeblocks_user_id ON time_blocks(user_id)`,
  
  `CREATE INDEX IF NOT EXISTS idx_time_range ON time_blocks(user_id, start_time, end_time)`
]

/**
 * 数据库适配器
 */
export const database = {
  /**
   * 初始化数据库连接
   * @returns {Promise<boolean>}
   */
  async init() {
    try {
      if (isElectron) {
        // Electron: 使用现有的 sql.js（通过 IPC 或主进程）
        // 注意：Electron 端需要保持现有架构，主进程处理数据库
        console.log('[Database] Electron 模式：使用 sql.js')
        isInitialized = true
        return true
      } else if (isCapacitor) {
        // Capacitor: 初始化 SQLite 插件
        console.log('[Database] Capacitor 模式：初始化 SQLite 插件')

        // 创建连接（如果不存在）
        const ret = await CapacitorSQLite.createConnection({
          database: 'timeblock_local',
          version: 1,
          encrypted: false
        })

        // 打开数据库
        await CapacitorSQLite.open({ database: 'timeblock_local' })
        isInitialized = true
        console.log('[Database] Capacitor SQLite 已打开')
        
        // 执行建表 SQL（直接调用 CapacitorSQLite.run）
        console.log('[Database] 开始执行 Schema 建表...')
        for (const sql of SCHEMA_SQL) {
          try {
            // 直接调用 CapacitorSQLite.run 执行建表
            const result = await CapacitorSQLite.run({
              statement: sql,
              values: [],
              database: DATABASE_NAME
            })
            console.log('[Database] 执行成功:', sql.substring(0, 50) + '...')
          } catch (err) {
            // CREATE TABLE IF NOT EXISTS 重复执行不会报错，忽略
            if (!err.message?.includes('already exists')) {
              console.error('[Database] Schema 执行失败:', err.message, sql.substring(0, 60))
              throw err  // 建表失败应该抛出错误
            }
          }
        }
        console.log('[Database] Schema 建表完成')
        
        // 创建默认用户
        const users = await this.query('SELECT * FROM users WHERE id = ?', [DEFAULT_USER_ID])
        if (users.length === 0) {
          console.log('[Database] 创建默认本地用户')
          await this.run(
            'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
            [DEFAULT_USER_ID, 'local@timeblock.app', 'local_no_auth', '本地用户']
          )
        }
        
        // 创建默认便签
        const notes = await this.query('SELECT * FROM notes WHERE user_id = ?', [DEFAULT_USER_ID])
        if (notes.length === 0) {
          console.log('[Database] 创建默认便签')
          const defaultNotes = [
            { name: '工作', color: '#409eff' },
            { name: '学习', color: '#67c23a' },
            { name: '休息', color: '#e6a23c' },
            { name: '运动', color: '#f56c6c' },
            { name: '生活', color: '#9254de' },
            { name: '其他', color: '#909399' }
          ]
          for (const note of defaultNotes) {
            await this.run(
              'INSERT INTO notes (user_id, name, color) VALUES (?, ?, ?)',
              [DEFAULT_USER_ID, note.name, note.color]
            )
          }
        }
        
        console.log('[Database] Capacitor 数据库初始化完成')
        return true
      } else {
        console.warn('[Database] Web 模式：不支持本地数据库')
        return false
      }
    } catch (error) {
      console.error('[Database] 初始化失败:', error)
      return false
    }
  },

  /**
   * 执行查询（SELECT）
   * @param {string} sql SQL语句
   * @param {Array} params 参数数组
   * @returns {Promise<Array>} 结果数组（对象格式）
   */
  async query(sql, params = []) {
    if (!isInitialized) {
      throw new Error('[Database] 数据库未初始化，请先调用 init()')
    }

    try {
      if (isElectron) {
        // Electron: 通过 IPC 调用主进程（异步）
        const result = await window.electronAPI?.dbQuery?.(sql, params)
        return result || []
      } else if (isCapacitor) {
        // Capacitor: 使用插件查询
        const result = await CapacitorSQLite.query({
          statement: sql,
          values: params,
          database: DATABASE_NAME  // ⚠️ 必须指定数据库
        })

        // Capacitor 返回格式：{ values: [...] }
        // 需转换为统一的对象数组格式
        return result.values || []
      } else {
        console.warn('[Database] Web 模式不支持查询')
        return []
      }
    } catch (error) {
      console.error('[Database] 查询失败:', sql, error)
      throw error
    }
  },

  /**
   * 执行写入（INSERT/UPDATE/DELETE）
   * @param {string} sql SQL语句
   * @param {Array} params 参数数组
   * @returns {Promise<{lastInsertRowid?: number, changes: number}>}
   */
  async run(sql, params = []) {
    if (!isInitialized) {
      throw new Error('[Database] 数据库未初始化，请先调用 init()')
    }

    try {
      if (isElectron) {
        // Electron: 通过 IPC 调用（异步）
        // 根据 SQL 类型选择合适的 API
        const sqlType = sql.trim().toUpperCase().split(' ')[0]
        let result

        if (sqlType === 'INSERT') {
          result = await window.electronAPI?.dbInsert?.(sql, params)
        } else if (sqlType === 'UPDATE') {
          result = await window.electronAPI?.dbUpdate?.(sql, params)
        } else if (sqlType === 'DELETE') {
          result = await window.electronAPI?.dbDelete?.(sql, params)
        } else {
          // 其他类型（如 CREATE TABLE）使用 dbInsert
          result = await window.electronAPI?.dbInsert?.(sql, params)
        }

        console.log('[Database] Electron 写入成功:', sqlType, result)
        return result || { changes: 0 }
      } else if (isCapacitor) {
        // Capacitor: 使用插件执行（自动持久化）
        console.log('[Database] Capacitor 执行写入:', sql.trim().substring(0, 60))
        
        const result = await CapacitorSQLite.run({
          statement: sql,
          values: params,
          database: DATABASE_NAME  // ⚠️ 必须指定数据库
        })

        console.log('[Database] Capacitor 写入结果:', {
          lastInsertRowId: result.changes?.lastInsertRowId,
          changes: result.changes?.changes
        })

        return {
          lastInsertRowid: result.changes?.lastInsertRowId || null,
          changes: result.changes?.changes || 0
        }
      } else {
        console.warn('[Database] Web 模式不支持写入')
        return { changes: 0 }
      }
    } catch (error) {
      console.error('[Database] 执行失败:', sql, error)
      throw error
    }
  },

  /**
   * 执行事务
   * @param {Function} callback 事务回调函数
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    if (!isInitialized) {
      throw new Error('[Database] 数据库未初始化')
    }

    try {
      if (isCapacitor) {
        // Capacitor: 使用插件事务
        await CapacitorSQLite.execute({ 
          statement: 'BEGIN TRANSACTION;',
          database: DATABASE_NAME
        })

        const result = await callback()

        await CapacitorSQLite.execute({ 
          statement: 'COMMIT;',
          database: DATABASE_NAME
        })
        return result
      } else {
        // Electron: 简化实现（暂时不支持事务）
        console.warn('[Database] Electron 模式暂不支持事务，直接执行')
        return await callback()
      }
    } catch (error) {
      if (isCapacitor) {
        await CapacitorSQLite.execute({ 
          statement: 'ROLLBACK;',
          database: DATABASE_NAME
        })
      }
      console.error('[Database] 事务失败:', error)
      throw error
    }
  },

  /**
   * 关闭数据库连接
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (isCapacitor) {
        await CapacitorSQLite.close({ database: 'timeblock_local' })
        console.log('[Database] Capacitor SQLite 已关闭')
      }
      isInitialized = false
    } catch (error) {
      console.error('[Database] 关闭失败:', error)
    }
  },

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isReady() {
    return isInitialized
  },

  /**
   * 验证数据库是否可用（测试查询）
   * @returns {Promise<boolean>}
   */
  async validateDatabase() {
    try {
      if (!isInitialized) {
        console.warn('[Database] 数据库未初始化')
        return false
      }

      // 尝试查询用户表验证数据库可用性
      if (isCapacitor) {
        const result = await CapacitorSQLite.query({
          statement: 'SELECT COUNT(*) as count FROM users;',
          values: [],  // ⚠️ 必须提供，即使是空数组
          database: DATABASE_NAME
        })
        console.log('[Database] 数据库验证成功，用户数:', result.values?.[0]?.count)
        return true
      } else if (isElectron) {
        const result = await window.electronAPI?.dbQuery?.('SELECT COUNT(*) as count FROM users;')
        console.log('[Database] Electron 数据库验证成功')
        return true
      }
      
      return false
    } catch (error) {
      console.error('[Database] 数据库验证失败:', error)
      return false
    }
  },

  /**
   * 获取数据库详细信息（调试用）
   * @returns {Promise<Object>}
   */
  async getDebugInfo() {
    try {
      const info = {
        platform: isElectron ? 'electron' : isCapacitor ? 'capacitor' : 'web',
        isInitialized,
        tables: []
      }

      if (isInitialized && isCapacitor) {
        // 查询所有表名
        const result = await CapacitorSQLite.query({
          statement: "SELECT name FROM sqlite_master WHERE type='table';",
          values: [],  // ⚠️ 必须提供
          database: DATABASE_NAME
        })
        info.tables = result.values?.map(row => row.name) || []
        
        // 查询用户数
        const userCount = await CapacitorSQLite.query({
          statement: 'SELECT COUNT(*) as count FROM users;',
          values: [],  // ⚠️ 必须提供
          database: DATABASE_NAME
        })
        info.userCount = userCount.values?.[0]?.count || 0
        
        // 查询便签数
        const noteCount = await CapacitorSQLite.query({
          statement: 'SELECT COUNT(*) as count FROM notes;',
          values: [],  // ⚠️ 必须提供
          database: DATABASE_NAME
        })
        info.noteCount = noteCount.values?.[0]?.count || 0
      }

      return info
    } catch (error) {
      console.error('[Database] 获取调试信息失败:', error)
      return { error: error.message }
    }
  }
}