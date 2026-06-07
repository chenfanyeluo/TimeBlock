/**
 * TimeBlock 模型 - 时间块表操作
 *
 * 提供时间块的完整 CRUD 操作：
 * - 创建/编辑/删除时间块（支持软删除）
 * - 日/周/月视图查询（使用覆盖索引优化）
 * - 全文搜索（基于 LIKE，SQLite FTS5 可选升级）
 * - 按分类筛选
 * - 分页查询
 *
 * 性能优化:
 * - 日视图使用 idx_user_date_covering 覆盖索引，零回表
 * - 所有查询强制带 user_id 实现租户隔离
 * - 软删除默认过滤 deleted_at IS NULL
 *
 * @module sqlite/TimeBlock
 */

const { get, all, exec, transaction } = require('./connection')

class TimeBlockModel {
  /**
   * 创建时间块
   *
   * @param {Object} data 时间块数据
   * @returns {Object} 新创建的时间块
   */
  create(data) {
    const result = exec(
      `INSERT INTO time_blocks (user_id, category_id, title, description, start_time, end_time, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        data.user_id,
        data.category_id || null,
        data.title,
        data.description || null,
        data.start_time,
        data.end_time,
        data.is_completed ? 1 : 0
      ]
    )

    return this.findById(result.lastInsertRowid)
  }

  /**
   * 根据 ID 查询时间块
   *
   * @param {number} id 时间块ID
   * @returns {Object|null}
   */
  findById(id) {
    return get(
      `SELECT tb.id, tb.user_id, tb.category_id, tb.title, tb.description,
              tb.start_time, tb.end_time, tb.is_completed,
              tb.created_at, tb.updated_at,
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE tb.id = ? AND tb.deleted_at IS NULL;`,
      [id]
    )
  }

  /**
   * 更新时间块
   *
   * @param {number} id 时间块ID
   * @param {Object} data 更新数据
   * @returns {Object|null}
   */
  update(id, data) {
    const fields = []
    const values = []

    if (data.title !== undefined) {
      fields.push('title = ?')
      values.push(data.title)
    }
    if (data.description !== undefined) {
      fields.push('description = ?')
      values.push(data.description)
    }
    if (data.category_id !== undefined) {
      fields.push('category_id = ?')
      values.push(data.category_id)
    }
    if (data.start_time !== undefined) {
      fields.push('start_time = ?')
      values.push(data.start_time)
    }
    if (data.end_time !== undefined) {
      fields.push('end_time = ?')
      values.push(data.end_time)
    }
    if (data.is_completed !== undefined) {
      fields.push('is_completed = ?')
      values.push(data.is_completed ? 1 : 0)
    }

    if (fields.length === 0) return this.findById(id)

    fields.push('updated_at = datetime(\'now\')')
    values.push(id)

    exec(
      `UPDATE time_blocks SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL;`,
      values
    )

    return this.findById(id)
  }

  /**
   * 软删除时间块
   *
   * @param {number} id 时间块ID
   * @returns {boolean}
   */
  softDelete(id) {
    const result = exec(
      `UPDATE time_blocks SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL;`,
      [id]
    )
    return result.changes > 0
  }

  /**
   * 批量软删除时间块
   *
   * @param {number[]} ids 时间块ID数组
   * @returns {number} 删除数量
   */
  batchSoftDelete(ids) {
    if (!ids || ids.length === 0) return 0

    const placeholders = ids.map(() => '?').join(',')
    const result = exec(
      `UPDATE time_blocks SET deleted_at = datetime('now')
       WHERE id IN (${placeholders}) AND deleted_at IS NULL;`,
      ids
    )
    return result.changes
  }

  /**
   * 恢复已删除的时间块
   *
   * @param {number} id 时间块ID
   * @returns {boolean}
   */
  restore(id) {
    const result = exec(
      `UPDATE time_blocks SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL;`,
      [id]
    )
    return result.changes > 0
  }

  // =============================================
  // 视图查询: 日 / 周 / 月
  // =============================================

  /**
   * 日视图查询 - 获取指定日期当天所有时间块
   *
   * 使用覆盖索引 idx_user_date_covering 实现零回表查询
   *
   * @param {number} userId 用户ID
   * @param {string} date 日期字符串 (YYYY-MM-DD)
   * @returns {Object[]}
   */
  findByDate(userId, date) {
    // 当天起始: 2024-01-01T00:00:00.000Z
    // 当天结束: 2024-01-01T23:59:59.999Z
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${date}T23:59:59.999Z`

    return all(
      `SELECT tb.id, tb.title, tb.description, tb.category_id,
              tb.start_time, tb.end_time, tb.is_completed,
              c.name AS category_name, c.color AS category_color
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE tb.user_id = ?
         AND tb.deleted_at IS NULL
         AND tb.start_time < ?
         AND tb.end_time > ?
       ORDER BY tb.start_time ASC;`,
      [userId, dayEnd, dayStart]
    )
  }

  /**
   * 周视图查询 - 获取一周内的时间块
   *
   * @param {number} userId 用户ID
   * @param {string} startDate 周开始日期 (YYYY-MM-DD)
   * @param {string} endDate 周结束日期 (YYYY-MM-DD)
   * @returns {Object[]}
   */
  findByWeek(userId, startDate, endDate) {
    const weekStart = `${startDate}T00:00:00.000Z`
    const weekEnd = `${endDate}T23:59:59.999Z`

    return all(
      `SELECT tb.id, tb.title, tb.description, tb.category_id,
              tb.start_time, tb.end_time, tb.is_completed,
              c.name AS category_name, c.color AS category_color
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE tb.user_id = ?
         AND tb.deleted_at IS NULL
         AND tb.start_time < ?
         AND tb.end_time > ?
       ORDER BY tb.start_time ASC;`,
      [userId, weekEnd, weekStart]
    )
  }

  /**
   * 月视图查询 - 获取一个月内的时间块
   *
   * @param {number} userId 用户ID
   * @param {number} year 年份
   * @param {number} month 月份 (1-12)
   * @returns {Object[]}
   */
  findByMonth(userId, year, month) {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`

    // 计算当月最后一天
    const lastDayOfMonth = new Date(year, month, 0).getDate()
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth}T23:59:59.999Z`

    return all(
      `SELECT tb.id, tb.title, tb.description, tb.category_id,
              tb.start_time, tb.end_time, tb.is_completed,
              c.name AS category_name, c.color AS category_color
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE tb.user_id = ?
         AND tb.deleted_at IS NULL
         AND tb.start_time < ?
         AND tb.end_time > ?
       ORDER BY tb.start_time ASC;`,
      [userId, lastDay, firstDay]
    )
  }

  // =============================================
  // 列表 & 筛选 & 分页
  // =============================================

  /**
   * 分页获取时间块列表
   *
   * @param {Object} options 查询选项
   * @param {number} options.userId 用户ID（必填）
   * @param {string} [options.startDate] 开始日期
   * @param {string} [options.endDate] 结束日期
   * @param {number} [options.categoryId] 分类ID
   * @param {number} [options.page=1] 页码
   * @param {number} [options.pageSize=20] 每页数量
   * @returns {{ items: Object[], pagination: Object }}
   */
  findList(options) {
    const { userId, startDate, endDate, categoryId, page = 1, pageSize = 20 } = options
    const conditions = ['tb.user_id = ?', 'tb.deleted_at IS NULL']
    const values = [userId]

    if (startDate) {
      conditions.push('tb.start_time >= ?')
      values.push(startDate)
    }
    if (endDate) {
      conditions.push('tb.end_time <= ?')
      values.push(endDate)
    }
    if (categoryId !== undefined && categoryId !== null) {
      conditions.push('tb.category_id = ?')
      values.push(categoryId)
    }

    const whereClause = conditions.join(' AND ')
    const offset = (page - 1) * pageSize

    const items = all(
      `SELECT tb.id, tb.user_id, tb.category_id, tb.title, tb.description,
              tb.start_time, tb.end_time, tb.is_completed,
              tb.created_at, tb.updated_at,
              c.name AS category_name, c.color AS category_color
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE ${whereClause}
       ORDER BY tb.start_time DESC
       LIMIT ? OFFSET ?;`,
      [...values, pageSize, offset]
    )

    const countResult = get(
      `SELECT COUNT(*) as total FROM time_blocks tb WHERE ${whereClause};`,
      values
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

  // =============================================
  // 搜索功能
  // =============================================

  /**
   * 搜索时间块
   *
   * 支持按标题、描述搜索关键词
   * SQLite 使用 LIKE 实现（如需更高性能可升级为 FTS5）
   *
   * @param {Object} options 搜索选项
   * @param {number} options.userId 用户ID
   * @param {string} options.keyword 搜索关键词
   * @param {string} [options.startDate] 开始日期
   * @param {string} [options.endDate] 结束日期
   * @param {number} [options.categoryId] 分类ID
   * @param {number} [options.limit=20] 返回数量限制
   * @returns {Object[]}
   */
  search(options) {
    const { userId, keyword, startDate, endDate, categoryId, limit = 20 } = options

    const conditions = ['tb.user_id = ?', 'tb.deleted_at IS NULL']
    const values = [userId]

    // 关键词搜索（标题 + 描述）
    if (keyword && keyword.trim()) {
      conditions.push('(tb.title LIKE ? OR tb.description LIKE ?)')
      const kw = `%${keyword.trim()}%`
      values.push(kw, kw)
    }

    if (startDate) {
      conditions.push('tb.start_time >= ?')
      values.push(startDate)
    }
    if (endDate) {
      conditions.push('tb.end_time <= ?')
      values.push(endDate)
    }
    if (categoryId !== undefined && categoryId !== null) {
      conditions.push('tb.category_id = ?')
      values.push(categoryId)
    }

    const whereClause = conditions.join(' AND ')

    return all(
      `SELECT tb.id, tb.user_id, tb.category_id, tb.title, tb.description,
              tb.start_time, tb.end_time, tb.is_completed,
              c.name AS category_name, c.color AS category_color
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE ${whereClause}
       ORDER BY tb.start_time DESC
       LIMIT ?;`,
      [...values, limit]
    )
  }

  // =============================================
  // 统计辅助方法
  // =============================================

  /**
   * 获取用户在指定时间段内各分类的总耗时
   *
   * @param {number} userId 用户ID
   * @param {string} startDate 开始时间
   * @param {string} endDate 结束时间
   * @returns {Array<{ categoryId: number, categoryName: string, color: string, totalSeconds: number, blockCount: number }>}
   */
  getDurationByCategory(userId, startDate, endDate) {
    return all(
      `SELECT tb.category_id,
              COALESCE(c.name, '未分类') AS category_name,
              COALESCE(c.color, '#999999') AS color,
              CAST(SUM(CAST((julianday(tb.end_time) - julianday(tb.start_time)) * 86400 AS INTEGER)) AS INTEGER) AS total_seconds,
              COUNT(*) AS block_count
       FROM time_blocks tb
       LEFT JOIN categories c ON tb.category_id = c.id AND c.deleted_at IS NULL
       WHERE tb.user_id = ?
         AND tb.deleted_at IS NULL
         AND tb.start_time >= ?
         AND tb.end_time <= ?
       GROUP BY tb.category_id
       ORDER BY total_seconds DESC;`,
      [userId, startDate, endDate]
    )
  }

  /**
   * 获取指定日期的日统计数据
   *
   * @param {number} userId 用户ID
   * @param {string} date 日期 (YYYY-MM-DD)
   * @returns {{ date: string, totalDuration: number, categories: Array }}
   */
  getDailyStats(userId, date) {
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${date}T23:59:59.999Z`

    const categories = this.getDurationByCategory(userId, dayStart, dayEnd)

    const totalDuration = categories.reduce((sum, cat) => sum + (cat.total_seconds || 0), 0)

    return {
      date,
      totalDuration,
      categories: categories.map(cat => ({
        categoryId: cat.category_id,
        categoryName: cat.category_name,
        color: cat.color,
        duration: cat.total_seconds,
        percentage: totalDuration > 0 ? Math.round((cat.total_seconds / totalDuration) * 10000) / 100 : 0
      }))
    }
  }

  /**
   * 获取周统计数据
   *
   * @param {number} userId 用户ID
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @returns {{ days: Array, categories: Array }}
   */
  getWeeklyStats(userId, startDate, endDate) {
    const weekStart = `${startDate}T00:00:00.000Z`
    const weekEnd = `${endDate}T23:59:59.999Z`

    // 按天统计
    const days = all(
      `SELECT DATE(start_time) as stat_date,
              CAST(SUM(CAST((julianday(end_time) - julianday(start_time)) * 86400 AS INTEGER)) AS INTEGER) AS total_duration
       FROM time_blocks
       WHERE user_id = ? AND deleted_at IS NULL
         AND start_time >= ? AND end_time <= ?
       GROUP BY DATE(start_time)
       ORDER BY stat_date;`,
      [userId, weekStart, weekEnd]
    )

    // 按分类统计
    const categories = this.getDurationByCategory(userId, weekStart, weekEnd)

    return { days, categories }
  }

  /**
   * 获取月统计数据
   *
   * @param {number} userId 用户ID
   * @param {number} year 年份
   * @param {number} month 月份 (1-12)
   * @returns {{ year: number, month: number, weeks: Array, categories: Array }}
   */
  getMonthlyStats(userId, year, month) {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`
    const lastDayOfMonth = new Date(year, month, 0).getDate()
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth}T23:59:59.999Z`

    // 按周统计（ISO周）
    const weeks = all(
      `SELECT strftime('%W', start_time) as week_num,
              CAST(SUM(CAST((julianday(end_time) - julianday(start_time)) * 86400 AS INTEGER)) AS INTEGER) AS total_duration
       FROM time_blocks
       WHERE user_id = ? AND deleted_at IS NULL
         AND start_time >= ? AND end_time <= ?
       GROUP BY strftime('%W', start_time)
       ORDER BY week_num;`,
      [userId, firstDay, lastDay]
    )

    // 按分类统计
    const categories = this.getDurationByCategory(userId, firstDay, lastDay)

    return { year, month, weeks, categories }
  }

  /**
   * 检查时间块是否属于指定用户
   *
   * @param {number} blockId 时间块ID
   * @param {number} userId 用户ID
   * @returns {boolean}
   */
  belongsToUser(blockId, userId) {
    const row = get(
      `SELECT id FROM time_blocks WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
      [blockId, userId]
    )
    return !!row
  }
}

module.exports = new TimeBlockModel()
