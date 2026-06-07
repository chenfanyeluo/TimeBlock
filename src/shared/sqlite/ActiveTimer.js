/**
 * ActiveTimer 模型 - 计时器运行状态表操作
 *
 * 实现计时器核心功能：
 * - start:  开始计时（每用户同时仅一个）
 * - stop:   停止计时，将结果保存为 time_block
 * - pause:  暂停计时（累计暂停时长）
 * - resume: 恢复计时
 * - active: 查询当前运行中的计时器状态
 *
 * 核心约束:
 * - PRIMARY KEY(user_id) 保证每用户同时只有一个运行中的计时器
 * - elapsed_paused 累计暂停时长（秒），支持多次暂停/恢复
 * - 停止时自动计算总耗时并写入 time_blocks 表
 *
 * @module sqlite/ActiveTimer
 */

const { get, exec, transaction } = require('./connection')

class ActiveTimerModel {
  /**
   * 开始计时
   *
   * @param {{ user_id: number, title: string, category_id?: number }} data
   * @throws {Error} 如果该用户已有运行中的计时器（409 CONFLICT）
   * @returns {Object} 创建的计时器记录
   */
  start(data) {
    // 先检查是否已有运行中的计时器
    const existing = this.getActiveByUserId(data.user_id)
    if (existing) {
      const err = new Error(`用户已有运行中的计时器: "${existing.title}"`)
      err.code = 'TIMER_ALREADY_RUNNING'
      err.statusCode = 409
      throw err
    }

    const now = new Date().toISOString()

    exec(
      `INSERT INTO active_timers (user_id, title, category_id, started_at)
       VALUES (?, ?, ?, ?);`,
      [data.user_id, data.title, data.category_id || null, now]
    )

    return this.getActiveByUserId(data.user_id)
  }

  /**
   * 停止计时
   *
   * 将计时结果保存为正式的 time_block 记录：
   * - start_time = started_at（计时开始时刻）
   * - end_time = 当前时刻
   * - 总耗时 = (now - started_at) - elapsed_paused
   *
   * @param {number} userId 用户ID
   * @param {{ title?: string, category_id?: number, description?: string }} [finalData] 停止时可修改最终信息
   * @throws {Error} 如果无运行中的计时器（404 NOT_FOUND）
   * @returns {{ timeBlockId: number, title: string, startTime: string, endTime: string, durationSeconds: number }}
   */
  stop(userId, finalData = {}) {
    const timer = this.getActiveByUserId(userId)
    if (!timer) {
      const err = new Error('无运行中的计时器')
      err.code = 'TIMER_NOT_FOUND'
      err.statusCode = 404
      throw err
    }

    const now = new Date().toISOString()
    const startedAt = new Date(timer.startedAt).getTime()
    const currentTime = new Date(now).getTime()

    // 计算实际计时时长（毫秒转秒，向下取整）
    let elapsedMs = currentTime - startedAt

    // 如果处于暂停状态，暂停期间不计入
    if (timer.isPaused) {
      elapsedMs = 0
    }

    const elapsedPausedMs = (timer.elapsedPaused || 0) * 1000
    const totalElapsedSeconds = Math.max(0, Math.floor((elapsedMs - elapsedPausedMs) / 1000))

    // 构建最终 time_block 数据
    const blockData = {
      user_id: userId,
      title: finalData.title || timer.title,
      category_id: finalData.category_id !== undefined ? finalData.category_id : timer.categoryId,
      description: finalData.description || null,
      start_time: timer.startedAt,
      end_time: now,
      is_completed: 1
    }

    let timeBlockId = null

    // 直接执行（不使用 transaction 包裹，避免 exec() 内部 save 破坏事务）
    // 本地 SQLite 单用户场景下，两步操作顺序执行即可保证一致性
    const database = require('./connection').getDB()
    database.run('BEGIN TRANSACTION;')

    try {
      // 写入 time_blocks 表
      database.run(
        `INSERT INTO time_blocks (user_id, category_id, title, description, start_time, end_time, is_completed)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          blockData.user_id,
          blockData.category_id,
          blockData.title,
          blockData.description,
          blockData.start_time,
          blockData.end_time,
          blockData.is_completed
        ]
      )

      // 获取最后插入 ID
      const rowIdStmt = database.prepare('SELECT last_insert_rowid();')
      rowIdStmt.step()
      timeBlockId = rowIdStmt.get()[0]
      rowIdStmt.free()

      // 删除 active_timers 记录
      database.run(`DELETE FROM active_timers WHERE user_id = ?;`, [userId])

      database.run('COMMIT;')
      require('./connection').save()
    } catch (e) {
      try { database.run('ROLLBACK;') } catch (_) {}
      throw e
    }

    return {
      timeBlockId,
      title: blockData.title,
      startTime: blockData.start_time,
      endTime: blockData.end_time,
      durationSeconds: totalElapsedSeconds
    }
  }

  /**
   * 暂停计时
   *
   * - 设置 is_paused = 1
   * - 将本次暂停时段加入 elapsed_paused
   * - 已暂停时幂等返回当前状态
   *
   * @param {number} userId 用户ID
   * @throws {Error} 无运行中计时器时返回 404
   * @returns {{ isPaused: boolean, elapsedPaused: number, message: string }}
   */
  pause(userId) {
    const timer = this.getActiveByUserId(userId)
    if (!timer) {
      const err = new Error('无运行中的计时器')
      err.code = 'TIMER_NOT_FOUND'
      err.statusCode = 404
      throw err
    }

    // 已暂停 → 幂等返回
    if (timer.isPaused) {
      return {
        isPaused: true,
        elapsedPaused: timer.elapsedPaused,
        message: `已暂停，累计暂停时长 ${timer.elapsedPaused} 秒`
      }
    }

    const now = new Date().getTime()
    const startedAt = new Date(timer.startedAt).getTime()
    const previousPausedMs = (timer.elapsedPaused || 0) * 1000

    // 本次运行的时长
    const currentSessionMs = now - startedAt
    // 新的累计暂停时长 = 之前暂停时长 + 本次新增暂停时间
    const additionalPause = Math.max(0, Math.floor((currentSessionMs - previousPausedMs) / 1000))
    const newElapsedPaused = Math.max(0, (timer.elapsedPaused || 0) + additionalPause)

    exec(
      `UPDATE active_timers SET is_paused = 1, elapsed_paused = ? WHERE user_id = ?;`,
      [newElapsedPaused, userId]
    )

    return {
      isPaused: true,
      elapsedPaused: newElapsedPaused,
      message: `已暂停，累计暂停时长 ${newElapsedPaused} 秒`
    }
  }

  /**
   * 恢复计时
   *
   * - 设置 is_paused = 0
   * - 未在暂停状态时幂等返回当前状态
   *
   * @param {number} userId 用户ID
   * @throws {Error} 无运行中计时器时返回 404
   * @returns {{ isPaused: boolean, elapsedPaused: number, message: string }}
   */
  resume(userId) {
    const timer = this.getActiveByUserId(userId)
    if (!timer) {
      const err = new Error('无运行中的计时器')
      err.code = 'TIMER_NOT_FOUND'
      err.statusCode = 404
      throw err
    }

    // 未暂停 → 幂等返回
    if (!timer.isPaused) {
      return {
        isPaused: false,
        elapsedPaused: timer.elapsedPaused,
        message: '计时进行中'
      }
    }

    exec(
      `UPDATE active_timers SET is_paused = 0 WHERE user_id = ?;`,
      [userId]
    )

    return {
      isPaused: false,
      elapsedPaused: timer.elapsed_paused,
      message: '已恢复计时'
    }
  }

  /**
   * 查询用户当前运行中的计时器
   *
   * 用于:
   * - 应用启动时检查是否有需要恢复的计时器
   * - 跨设备同步计时器状态
   * - 前端实时显示计时器界面
   *
   * @param {number} userId 用户ID
   * @returns {Object|null} 计时器完整信息，含实时计算的 elapsedTotal
   */
  getActiveByUserId(userId) {
    const timer = get(
      `SELECT t.user_id, t.time_block_id, t.title, t.category_id,
              t.started_at, t.elapsed_paused, t.is_paused, t.created_at,
              c.id AS category_id_val, c.name AS category_name, c.color AS category_color
       FROM active_timers t
       LEFT JOIN categories c ON t.category_id = c.id AND c.deleted_at IS NULL
       WHERE t.user_id = ?;`,
      [userId]
    )

    if (!timer) return null

    // 实时计算总耗时
    const now = new Date().getTime()
    const startedAt = new Date(timer.started_at).getTime()
    const elapsedPausedMs = (timer.elapsed_paused || 0) * 1000

    let elapsedTotal = 0

    if (timer.is_paused) {
      // 已暂停：总耗时就是累计暂停时长（即有效计时时长 = 总经过时间 - 暂停时长）
      // 实际上 paused 时，有效时间 = (started_at -> now) - elapsed_paused
      // 但 paused 后不再增加，所以 elapsedTotal = elapsed_paused
      elapsedTotal = timer.elapsed_paused
    } else {
      // 运行中：(当前时间 - 启动时间) - 累计暂停时长
      const rawElapsed = Math.floor((now - startedAt) / 1000)
      elapsedTotal = Math.max(0, rawElapsed - timer.elapsed_paused)
    }

    return {
      userId: timer.user_id,
      timeBlockId: timer.time_block_id,
      title: timer.title,
      categoryId: timer.category_id,
      category: timer.category_name ? {
        id: timer.category_id_val,
        name: timer.category_name,
        color: timer.category_color
      } : null,
      startedAt: timer.started_at,
      isPaused: !!timer.is_paused,
      elapsedPaused: timer.elapsed_paused,
      elapsedTotal,
      createdAt: timer.created_at
    }
  }

  /**
   * 强制清除用户的运行中计时器（异常恢复用）
   *
   * @param {number} userId 用户ID
   * @returns {boolean}
   */
  forceStop(userId) {
    const result = exec(`DELETE FROM active_timers WHERE user_id = ?;`, [userId])
    return result.changes > 0
  }
}

module.exports = new ActiveTimerModel()
