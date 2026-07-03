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
          values: params
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

        return result || { changes: 0 }
      } else if (isCapacitor) {
        // Capacitor: 使用插件执行
        const result = await CapacitorSQLite.run({
          statement: sql,
          values: params
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
        await CapacitorSQLite.execute({ statement: 'BEGIN TRANSACTION;' })

        const result = await callback()

        await CapacitorSQLite.execute({ statement: 'COMMIT;' })
        return result
      } else {
        // Electron: 简化实现（暂时不支持事务）
        console.warn('[Database] Electron 模式暂不支持事务，直接执行')
        return await callback()
      }
    } catch (error) {
      if (isCapacitor) {
        await CapacitorSQLite.execute({ statement: 'ROLLBACK;' })
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
  }
}