/**
 * Statistic 模型 - 统计汇总表操作
 *
 * 预计算的日统计数据，提高报表查询效率。
 * 存储每个用户每天每个分类的总时间和时间块数量。
 *
 * 设计说明:
 * - UNIQUE(user_id, stat_date, category_id) 防止重复
 * - category_id=NULL 表示全天总计行
 * - 由 TimeBlock 写入后触发更新或定时任务刷新
 *
 * @module sqlite/Statistic
 */

const { get, all, exec, execInTx, transaction } = require('./connection')

class StatisticModel {
  /**
   * 创建或更新统计记录（UPSERT）
   *
   * SQLite 3.24+ 支持 ON CONFLICT 语法实现 upsert
   *
   * @param {{ user_id: number, stat_date: string, category_id?: number|null, total_seconds: number, block_count: number }} data
   * @returns {Object}
   */
  upsert(data) {
    exec(
      `INSERT INTO statistics (user_id, stat_date, category_id, total_seconds, block_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, stat_date, category_id)
       DO UPDATE SET
         total_seconds = excluded.total_seconds,
         block_count = excluded.block_count;`,
      [
        data.user_id,
        data.stat_date,
        data.category_id || null,
        data.total_seconds || 0,
        data.block_count || 0
      ]
    )

    return this.findByUnique(data.user_id, data.stat_date, data.category_id)
  }

  /**
   * 根据唯一约束查询
   *
   * @param {number} userId 用户ID
   * @param {string} statDate 统计日期
   * @param {number|null} [categoryId] 分类ID
   * @returns {Object|null}
   */
  findByUnique(userId, statDate, categoryId) {
    return get(
      `SELECT s.*, c.name AS category_name, c.color AS category_color
       FROM statistics s
       LEFT JOIN categories c ON s.category_id = c.id AND c.deleted_at IS NULL
       WHERE s.user_id = ? AND s.stat_date = ? AND s.category_id IS ?;`,
      [userId, statDate, categoryId]
    )
  }

  /**
   * 获取指定日期的所有统计记录（含各分类明细 + 总计行）
   *
   * @param {number} userId 用户ID
   * @param {string} statDate 日期 (YYYY-MM-DD)
   * @returns {Object[]}
   */
  findByDate(userId, statDate) {
    return all(
      `SELECT s.*, c.name AS category_name, c.color AS category_color
       FROM statistics s
       LEFT JOIN categories c ON s.category_id = c.id AND c.deleted_at IS NULL
       WHERE s.user_id = ? AND s.stat_date = ?
       ORDER BY s.category_id IS NOT NULL, s.total_seconds DESC;`,
      [userId, statDate]
    )
  }

  /**
   * 获取用户在日期范围内的统计汇总
   *
   * @param {number} userId 用户ID
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @returns {Object[]}
   */
  findByDateRange(userId, startDate, endDate) {
    return all(
      `SELECT s.*, c.name AS category_name, c.color AS category_color
       FROM statistics s
       LEFT JOIN categories c ON s.category_id = c.id AND c.deleted_at IS NULL
       WHERE s.user_id = ? AND s.stat_date >= ? AND s.stat_date <= ?
       ORDER BY s.stat_date DESC, s.category_id IS NOT NULL, s.total_seconds DESC;`,
      [userId, startDate, endDate]
    )
  }

  /**
   * 获取用户所有统计记录（分页）
   *
   * @param {number} userId 用户ID
   * @param {number} [page=1] 页码
   * @param {number} [pageSize=30] 每页数量
   * @returns {{ items: Object[], pagination: Object }}
   */
  findByUserId(userId, page = 1, pageSize = 30) {
    const offset = (page - 1) * pageSize

    const items = all(
      `SELECT s.*, c.name AS category_name, c.color AS category_color
       FROM statistics s
       LEFT JOIN categories c ON s.category_id = c.id AND c.deleted_at IS NULL
       WHERE s.user_id = ?
       ORDER BY s.stat_date DESC, s.category_id IS NOT NULL
       LIMIT ? OFFSET ?;`,
      [userId, pageSize, offset]
    )

    const countResult = get(
      `SELECT COUNT(*) as total FROM statistics WHERE user_id = ?;`,
      [userId]
    )
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

  /**
   * 从 time_blocks 表重新计算并写入指定日期的统计数据
   *
   * 遍历该用户当天所有时间块，按 category_id 分组聚合，
   * 同时写入各行数据和一个全天的总计行 (category_id=NULL)
   *
   * @param {number} userId 用户ID
   * @param {string} statDate 日期 (YYYY-MM-DD)
   * @returns {Object} 汇总结果
   */
  recalculateForDate(userId, statDate) {
    const dayStart = `${statDate}T00:00:00.000Z`
    const dayEnd = `${statDate}T23:59:59.999Z`

    // 查询当日按分类分组的数据
    const categoryStats = all(
      `SELECT category_id,
              COUNT(*) AS block_count,
              CAST(SUM(CAST((julianday(end_time) - julianday(start_time)) * 86400 AS INTEGER)) AS INTEGER) AS total_seconds
       FROM time_blocks
       WHERE user_id = ? AND deleted_at IS NULL
         AND start_time >= ? AND end_time <= ?
       GROUP BY category_id;`,
      [userId, dayStart, dayEnd]
    )

    let grandTotalSeconds = 0
    let grandTotalBlocks = 0

    transaction((database) => {
      // 先删除旧数据
      execInTx(database,
        `DELETE FROM statistics WHERE user_id = ? AND stat_date = ?;`,
        [userId, statDate]
      )

      // 写入各分类行
      for (const stat of categoryStats) {
        execInTx(database,
          `INSERT INTO statistics (user_id, stat_date, category_id, total_seconds, block_count)
           VALUES (?, ?, ?, ?, ?);`,
          [userId, statDate, stat.category_id, stat.total_seconds || 0, stat.block_count || 0]
        )
        grandTotalSeconds += (stat.total_seconds || 0)
        grandTotalBlocks += (stat.block_count || 0)
      }

      // 写入全天总计行 (category_id = NULL)
      execInTx(database,
        `INSERT INTO statistics (user_id, stat_date, category_id, total_seconds, block_count)
         VALUES (?, ?, NULL, ?, ?);`,
        [userId, statDate, grandTotalSeconds, grandTotalBlocks]
      )
    })

    return {
      date: statDate,
      totalDuration: grandTotalSeconds,
      totalBlocks: grandTotalBlocks,
      categories: categoryStats.map(s => ({
        categoryId: s.category_id,
        blockCount: s.block_count,
        totalSeconds: s.total_seconds
      }))
    }
  }

  /**
   * 删除统计记录
   *
   * @param {number} id 记录ID
   * @returns {boolean}
   */
  delete(id) {
    const result = exec(`DELETE FROM statistics WHERE id = ?;`, [id])
    return result.changes > 0
  }

  /**
   * 删除用户在指定日期范围的所有统计
   *
   * @param {number} userId 用户ID
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @returns {number} 删除数量
   */
  deleteByDateRange(userId, startDate, endDate) {
    const result = exec(
      `DELETE FROM statistics
       WHERE user_id = ? AND stat_date >= ? AND stat_date <= ?;`,
      [userId, startDate, endDate]
    )
    return result.changes
  }
}

module.exports = new StatisticModel()
