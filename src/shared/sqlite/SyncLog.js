/**
 * SyncLog 模型 - 同步记录表操作
 *
 * 记录每次 SQLite ↔ MySQL 数据同步操作的详细信息:
 * - 同步类型 (manual/auto)
 * - 同步状态 (pending/in_progress/completed/failed)
 * - 同步记录数、起止时间、错误信息
 *
 * @module sqlite/SyncLog
 */

const { get, all, exec } = require('./connection')

class SyncLogModel {
  /**
   * 创建同步日志记录
   *
   * @param {{ user_id: number, sync_type?: string }} data
   * @returns {Object} 新创建的同步日志
   */
  create(data) {
    const result = exec(
      `INSERT INTO sync_logs (user_id, sync_type)
       VALUES (?, COALESCE(?, 'manual'));`,
      [data.user_id, data.sync_type || 'manual']
    )

    return this.findById(result.lastInsertRowid)
  }

  /**
   * 根据 ID 查询同步日志
   *
   * @param {number} id 日志ID
   * @returns {Object|null}
   */
  findById(id) {
    return get(
      `SELECT * FROM sync_logs WHERE id = ?;`,
      [id]
    )
  }

  /**
   * 更新同步状态
   *
   * @param {number} id 日志ID
   * @param {string} status 新状态
   * @param {Object} [extra] 额外更新字段
   * @returns {Object|null}
   */
  updateStatus(id, status, extra = {}) {
    const fields = ['status = ?', 'completed_at = datetime(\'now\')']
    const values = [status]

    if (extra.records_synced !== undefined) {
      fields.push('records_synced = ?')
      values.push(extra.records_synced)
    }
    if (extra.error_message !== undefined) {
      fields.push('error_message = ?')
      values.push(extra.error_message)
    }

    values.push(id)

    exec(
      `UPDATE sync_logs SET ${fields.join(', ')} WHERE id = ?;`,
      values
    )

    return this.findById(id)
  }

  /**
   * 标记同步开始
   *
   * @param {number} id 日志ID
   * @returns {Object|null}
   */
  markInProgress(id) {
    return this.updateStatus(id, 'in_progress')
  }

  /**
   * 标记同步完成
   *
   * @param {number} id 日志ID
   * @param {number} recordsSynced 同步记录数
   * @returns {Object|null}
   */
  markCompleted(id, recordsSynced) {
    return this.updateStatus(id, 'completed', { records_synced: recordsSynced })
  }

  /**
   * 标记同步失败
   *
   * @param {number} id 日志ID
   * @param {string} errorMessage 错误信息
   * @returns {Object|null}
   */
  markFailed(id, errorMessage) {
    return this.updateStatus(id, 'failed', { error_message: errorMessage })
  }

  /**
   * 获取用户的同步历史
   *
   * @param {number} userId 用户ID
   * @param {number} [limit=20] 返回数量限制
   * @returns {Object[]}
   */
  findByUserId(userId, limit = 20) {
    return all(
      `SELECT * FROM sync_logs
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT ?;`,
      [userId, limit]
    )
  }

  /**
   * 获取最近一次同步记录
   *
   * @param {number} userId 用户ID
   * @returns {Object|null}
   */
  findLatestByUserId(userId) {
    return get(
      `SELECT * FROM sync_logs
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT 1;`,
      [userId]
    )
  }

  /**
   * 获取所有同步日志（分页，管理用途）
   *
   * @param {number} [page=1] 页码
   * @param {number} [pageSize=20] 每页数量
   * @returns {{ items: Object[], pagination: Object }}
   */
  findAll(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize

    const items = all(
      `SELECT * FROM sync_logs
       ORDER BY started_at DESC
       LIMIT ? OFFSET ?;`,
      [pageSize, offset]
    )

    const countResult = get(`SELECT COUNT(*) as total FROM sync_logs;`)
    const total = countResult?.total || 0

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

module.exports = new SyncLogModel()
