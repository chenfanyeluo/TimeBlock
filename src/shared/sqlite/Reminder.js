/**
 * Reminder 模型 - 提醒通知表操作
 *
 * 实现提醒核心功能：
 * - create:     创建提醒（时间块级别或便签级别）
 * - update:     更新提醒
 * - remove:     删除/取消提醒
 * - getPending: 获取待触发的提醒列表
 * - trigger:    触发提醒（标记为已触发）
 * - dismiss:    关闭提醒（用户确认后）
 * - checkDue:   检查是否有需要触发的提醒（定时调用）
 *
 * 提醒类型：
 * - time_block: 时间块级别提醒，提醒时间基于时间块的开始时间
 * - note:       便签级别提醒，所有该便签的时间块都会自动创建提醒
 *
 * @module sqlite/Reminder
 */

const { get, all, exec, run } = require('./connection')

class ReminderModel {
  /**
   * 创建提醒
   *
   * @param {Object} data 提醒数据
   * @param {number} data.user_id 用户ID
   * @param {string} data.target_type 目标类型 ('time_block' | 'note')
   * @param {number} data.target_id 目标ID（时间块ID或便签ID）
   * @param {string} data.remind_at 提醒时间 (ISO格式)
   * @param {number} [data.advance_minutes=0] 提前提醒分钟数
   * @param {number} [data.is_auto=0] 是否自动生成
   * @param {number} [data.note_id=null] 关联便签ID（自动提醒时记录）
   * @param {string} data.title 提醒标题
   * @param {string} [data.message] 提醒消息
   * @returns {Object} 创建的提醒记录
   */
  create(data) {
    const now = new Date().toISOString()

    run(
      `INSERT INTO reminders (user_id, target_type, target_id, remind_at, advance_minutes, is_auto, note_id, title, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?);`,
      [
        data.user_id,
        data.target_type,
        data.target_id,
        data.remind_at,
        data.advance_minutes || 0,
        data.is_auto || 0,
        data.note_id || null,
        data.title,
        data.message || null,
        now,
        now
      ]
    )

    return this.getByTarget(data.user_id, data.target_type, data.target_id)
  }

  /**
   * 为时间块创建提醒
   *
   * 根据时间块的开始时间，自动计算提醒时间
   *
   * @param {number} userId 用户ID
   * @param {Object} timeBlock 时间块数据
   * @param {number} [advanceMinutes=5] 提前提醒分钟数
   * @param {boolean} [isAuto=false] 是否自动生成（便签自动提醒）
   * @param {number} [noteId=null] 关联便签ID
   * @returns {Object|null} 创建的提醒记录
   */
  createForTimeBlock(userId, timeBlock, advanceMinutes = 5, isAuto = false, noteId = null) {
    // 计算提醒时间：时间块开始时间 - 提前分钟数
    const startTime = new Date(timeBlock.start_time)
    const remindAt = new Date(startTime.getTime() - advanceMinutes * 60 * 1000)

    // 如果提醒时间已经过去，不创建提醒
    if (remindAt <= new Date()) {
      console.log('[Reminder] 提醒时间已过去，不创建提醒')
      return null
    }

    return this.create({
      user_id: userId,
      target_type: 'time_block',
      target_id: timeBlock.id,
      remind_at: remindAt.toISOString(),
      advance_minutes: advanceMinutes,
      is_auto: isAuto ? 1 : 0,
      note_id: noteId,
      title: `即将开始: ${timeBlock.title}`,
      message: `时间块 "${timeBlock.title}" 将在 ${advanceMinutes} 分钟后开始`
    })
  }

  /**
   * 根据目标获取提醒
   *
   * @param {number} userId 用户ID
   * @param {string} targetType 目标类型
   * @param {number} targetId 目标ID
   * @returns {Object|null} 提醒记录
   */
  getByTarget(userId, targetType, targetId) {
    return get(
      `SELECT * FROM reminders WHERE user_id = ? AND target_type = ? AND target_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1;`,
      [userId, targetType, targetId]
    )
  }

  /**
   * 获取用户所有待触发的提醒
   *
   * @param {number} userId 用户ID
   * @returns {Array} 待触发的提醒列表
   */
  getPending(userId) {
    return all(
      `SELECT * FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY remind_at ASC;`,
      [userId]
    )
  }

  /**
   * 获取用户所有提醒（包括历史）
   *
   * @param {number} userId 用户ID
   * @param {string} [status] 状态筛选
   * @returns {Array} 提醒列表
   */
  getAll(userId, status = null) {
    if (status) {
      return all(
        `SELECT * FROM reminders WHERE user_id = ? AND status = ? ORDER BY remind_at DESC;`,
        [userId, status]
      )
    }
    return all(
      `SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at DESC;`,
      [userId]
    )
  }

  /**
   * 检查是否有需要触发的提醒
   *
   * 此方法应由前端定时调用（如每分钟检查一次）
   *
   * @param {number} userId 用户ID
   * @returns {Array} 需要触发的提醒列表（已过提醒时间且状态为pending）
   */
  checkDue(userId) {
    const now = new Date().toISOString()
    return all(
      `SELECT * FROM reminders WHERE user_id = ? AND status = 'pending' AND remind_at <= ? ORDER BY remind_at ASC;`,
      [userId, now]
    )
  }

  /**
   * 触发提醒
   *
   * 将提醒状态标记为 'triggered'，并记录触发时间
   *
   * @param {number} reminderId 提醒ID
   * @returns {boolean} 是否成功
   */
  trigger(reminderId) {
    const now = new Date().toISOString()
    const result = run(
      `UPDATE reminders SET status = 'triggered', triggered_at = ?, updated_at = ? WHERE id = ?;`,
      [now, now, reminderId]
    )
    return result.changes > 0
  }

  /**
   * 关闭提醒（用户确认后）
   *
   * @param {number} reminderId 提醒ID
   * @returns {boolean} 是否成功
   */
  dismiss(reminderId) {
    const now = new Date().toISOString()
    const result = run(
      `UPDATE reminders SET status = 'dismissed', dismissed_at = ?, updated_at = ? WHERE id = ?;`,
      [now, now, reminderId]
    )
    return result.changes > 0
  }

  /**
   * 取消提醒
   *
   * @param {number} reminderId 提醒ID
   * @returns {boolean} 是否成功
   */
  cancel(reminderId) {
    const now = new Date().toISOString()
    const result = run(
      `UPDATE reminders SET status = 'cancelled', updated_at = ? WHERE id = ?;`,
      [now, reminderId]
    )
    return result.changes > 0
  }

  /**
   * 根据目标取消所有相关提醒
   *
   * @param {number} userId 用户ID
   * @param {string} targetType 目标类型
   * @param {number} targetId 目标ID
   * @returns {number} 取消的提醒数量
   */
  cancelByTarget(userId, targetType, targetId) {
    const now = new Date().toISOString()
    const result = run(
      `UPDATE reminders SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND target_type = ? AND target_id = ? AND status = 'pending';`,
      [now, userId, targetType, targetId]
    )
    return result.changes
  }

  /**
   * 更新提醒
   *
   * @param {number} reminderId 提醒ID
   * @param {Object} updates 更新字段
   * @returns {Object|null} 更新后的提醒
   */
  update(reminderId, updates) {
    const allowedFields = ['remind_at', 'advance_minutes', 'title', 'message', 'status']
    const fields = []
    const values = []
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length === 0) return null
    
    values.push(new Date().toISOString()) // updated_at
    values.push(reminderId)
    
    run(
      `UPDATE reminders SET ${fields.join(', ')}, updated_at = ? WHERE id = ?;`,
      values
    )
    
    return get(`SELECT * FROM reminders WHERE id = ?;`, [reminderId])
  }

  /**
   * 删除提醒（物理删除）
   *
   * @param {number} reminderId 提醒ID
   * @returns {boolean} 是否成功
   */
  remove(reminderId) {
    const result = run(`DELETE FROM reminders WHERE id = ?;`, [reminderId])
    return result.changes > 0
  }

  /**
   * 清理已处理的旧提醒
   *
   * 删除超过指定天数的已触发/已关闭/已取消的提醒
   *
   * @param {number} userId 用户ID
   * @param {number} [days=30] 保留天数
   * @returns {number} 删除的提醒数量
   */
  cleanup(userId, days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const result = run(
      `DELETE FROM reminders WHERE user_id = ? AND status IN ('triggered', 'dismissed', 'cancelled') AND updated_at < ?;`,
      [userId, cutoff]
    )
    return result.changes
  }

  /**
   * 获取便签的提醒配置
   *
   * 如果便签配置了提醒，返回该便签的提醒模板
   *
   * @param {number} userId 用户ID
   * @param {number} noteId 便签ID
   * @returns {Object|null} 便签提醒配置
   */
  getNoteReminderConfig(userId, noteId) {
    return get(
      `SELECT * FROM reminders WHERE user_id = ? AND target_type = 'note' AND target_id = ? AND status = 'pending' LIMIT 1;`,
      [userId, noteId]
    )
  }

  /**
   * 设置便签提醒配置
   *
   * 当设置了便签级别的提醒后，该便签的所有新时间块都会自动创建提醒
   *
   * @param {number} userId 用户ID
   * @param {number} noteId 便签ID
   * @param {string} noteName 便签名称
   * @param {number} advanceMinutes 提前提醒分钟数
   * @returns {Object} 创建的提醒配置
   */
  setNoteReminder(userId, noteId, noteName, advanceMinutes = 5) {
    // 先取消现有的便签提醒配置
    this.cancelByTarget(userId, 'note', noteId)
    
    // 创建新的便签提醒配置（作为模板，remind_at 设为未来日期，实际触发时动态计算）
    return this.create({
      user_id: userId,
      target_type: 'note',
      target_id: noteId,
      remind_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 默认一年后（作为配置标记）
      advance_minutes: advanceMinutes,
      title: `${noteName} 时间块提醒`,
      message: `便签 "${noteName}" 的时间块即将开始`
    })
  }

  /**
   * 移除便签提醒配置
   *
   * @param {number} userId 用户ID
   * @param {number} noteId 便签ID
   * @returns {number} 取消的提醒数量
   */
  removeNoteReminder(userId, noteId) {
    return this.cancelByTarget(userId, 'note', noteId)
  }
}

module.exports = new ReminderModel()