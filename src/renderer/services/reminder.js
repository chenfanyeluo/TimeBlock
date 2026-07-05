/**
 * 提醒通知服务
 *
 * 功能：
 * - 定时检查到期提醒（每分钟）
 * - 发送系统/浏览器通知（Electron 走主进程原生通知）
 * - 提醒触发后播放声音（可选）
 * - 支持三端（Web/Electron/Capacitor）
 */

import { platformInfo, database } from '@shared/platform'
import { ElNotification } from 'element-plus'
import dayjs from 'dayjs'
import { getUserId } from '@api/client'

// 提醒检查间隔（毫秒）
const CHECK_INTERVAL = 60 * 1000 // 1分钟

// 是否已请求通知权限
let notificationPermissionGranted = false

// 定时检查器 ID
let checkTimerId = null

// 音效（可选）
let reminderAudio = null

/**
 * 初始化提醒服务
 *
 * 请求通知权限、启动定时检查
 */
export async function initReminderService() {
  // 请求浏览器通知权限
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    notificationPermissionGranted = permission === 'granted'
    console.log('[Reminder] 通知权限:', permission)
  }

  // 加载音效（可选）
  try {
    reminderAudio = new Audio('/assets/reminder.mp3')
    reminderAudio.volume = 0.5
  } catch (err) {
    console.log('[Reminder] 未加载提醒音效')
  }

  // 启动定时检查
  startPeriodicCheck()

  console.log('[Reminder] 提醒服务已启动')
}

/**
 * 启动定时检查
 */
function startPeriodicCheck() {
  if (checkTimerId) {
    clearInterval(checkTimerId)
  }

  // 立即检查一次
  checkReminders()

  // 定时检查
  checkTimerId = setInterval(checkReminders, CHECK_INTERVAL)
}

/**
 * 停止定时检查
 */
export function stopReminderService() {
  if (checkTimerId) {
    clearInterval(checkTimerId)
    checkTimerId = null
  }
  console.log('[Reminder] 提醒服务已停止')
}

/**
 * 检查到期提醒
 *
 * 查询数据库中需要触发的提醒，发送通知并标记状态
 */
async function checkReminders() {
  // 仅在支持数据库的平台执行
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return
  }

  if (!database.isReady()) {
    return
  }

  try {
    // 查询需要触发的提醒（按当前登录用户过滤）
    // 使用 ISO 字符串参数化比较，避免与 SQLite datetime('now') 格式不一致导致字典序比较错误
    const nowIso = dayjs().toISOString()
    const dueReminders = await database.query(
      `SELECT * FROM reminders WHERE user_id = ? AND status = 'pending' AND remind_at <= ? ORDER BY remind_at ASC;`,
      [getUserId(), nowIso]
    )

    console.log('[Reminder] 检查到期提醒:', {
      nowIso,
      pendingCount: dueReminders.length,
      firstRemindAt: dueReminders.length > 0 ? dueReminders[0].remind_at : null
    })

    if (dueReminders.length === 0) {
      return
    }

    console.log('[Reminder] 发现到期提醒:', dueReminders.length)

    // 逐个触发提醒
    for (const reminder of dueReminders) {
      await triggerReminder(reminder)
    }

  } catch (err) {
    console.error('[Reminder] 检查提醒失败:', err)
  }
}

/**
 * 触发单个提醒
 *
 * @param {Object} reminder 提醒记录
 */
async function triggerReminder(reminder) {
  try {
    // 发送通知
    await sendNotification(reminder.title, reminder.message)

    // 播放音效
    if (reminderAudio) {
      try {
        await reminderAudio.play()
      } catch (e) {
        // 静默失败
      }
    }

    // 标记为已触发
    await database.run(
      `UPDATE reminders SET status = 'triggered', triggered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?;`,
      [reminder.id]
    )

    console.log('[Reminder] 提醒已触发:', reminder.id, reminder.title)

  } catch (err) {
    console.error('[Reminder] 触发提醒失败:', err)
  }
}

/**
 * 发送通知
 *
 * @param {string} title 通知标题
 * @param {string} body 通知内容
 */
async function sendNotification(title, body) {
  let systemNotified = false

  // Electron：通过主进程发送原生系统通知
  if (platformInfo.isElectron && window.electronAPI?.showNotification) {
    try {
      const result = await window.electronAPI.showNotification({
        title: title || 'TimeBlock',
        body: body || '',
        icon: '/assets/icon.png'
      })
      systemNotified = result && result.success
    } catch (err) {
      console.error('[Reminder] Electron 通知发送失败:', err)
    }
  }

  // Capacitor / Web：使用浏览器通知
  if (!systemNotified && notificationPermissionGranted && 'Notification' in window) {
    try {
      const notification = new Notification(title || 'TimeBlock', {
        body: body || '',
        icon: '/assets/icon.png',
        tag: 'timeblock-reminder',
        requireInteraction: true // 保持通知直到用户点击
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
      systemNotified = true
    } catch (err) {
      console.error('[Reminder] 浏览器通知发送失败:', err)
    }
  }

  // 若系统/浏览器通知均未成功，使用 Element Plus 应用内通知作为 fallback
  if (!systemNotified) {
    ElNotification({
      title: title || 'TimeBlock',
      message: body || '',
      type: 'warning',
      duration: 0, // 不自动关闭
      position: 'top-right'
    })
  }
}

/**
 * 为时间块创建提醒
 *
 * @param {Object} timeBlock 时间块数据
 * @param {number} advanceMinutes 提前提醒分钟数
 * @param {boolean} isAuto 是否自动生成（便签自动提醒）
 * @param {number} noteId 关联便签ID（自动提醒时记录）
 * @returns {Object|null} 创建的提醒
 */
export async function createTimeBlockReminder(timeBlock, advanceMinutes = 5, isAuto = false, noteId = null) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return null
  }

  if (!database.isReady()) {
    console.warn('[Reminder] 数据库未就绪')
    return null
  }

  // 确保 advanceMinutes 为数字
  const minutes = Number(advanceMinutes) || 5

  // 使用 dayjs 明确按本地时间解析，避免不同环境对 ISO 字符串解析行为不一致
  const startTime = dayjs(`${timeBlock.date} ${timeBlock.startTime}`, 'YYYY-MM-DD HH:mm')
  if (!startTime.isValid()) {
    console.error('[Reminder] 时间块开始时间解析失败:', timeBlock.date, timeBlock.startTime)
    return null
  }

  const remindAt = startTime.subtract(minutes, 'minute')

  console.log('[Reminder] 计算提醒时间:', {
    date: timeBlock.date,
    startTime: timeBlock.startTime,
    advanceMinutes: minutes,
    remindAtLocal: remindAt.format('YYYY-MM-DD HH:mm:ss'),
    remindAtIso: remindAt.toISOString(),
    nowIso: dayjs().toISOString()
  })

  // 如果提醒时间已过去，不创建
  if (remindAt.isSameOrBefore(dayjs())) {
    console.log('[Reminder] 提醒时间已过去，不创建')
    return null
  }

  try {
    const result = await database.run(
      `INSERT INTO reminders (user_id, target_type, target_id, remind_at, advance_minutes, is_auto, note_id, title, message, status, created_at, updated_at)
       VALUES (?, 'time_block', ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'));`,
      [
        getUserId(),
        timeBlock.id,
        remindAt.toISOString(),
        minutes,
        isAuto ? 1 : 0,
        noteId,
        `提醒您开始 ${timeBlock.title}`,
        `规划时间 "${timeBlock.title}" 将在 ${minutes} 分钟后开始`
      ]
    )

    console.log('[Reminder] 时间块提醒已创建:', result.lastInsertRowid, isAuto ? '(自动)' : '(手动)')
    return result

  } catch (err) {
    console.error('[Reminder] 创建时间块提醒失败:', err)
    return null
  }
}

/**
 * 取消时间块提醒
 *
 * @param {number} timeBlockId 时间块ID
 * @param {boolean} cancelNoteAuto 是否同时取消便签的自动提醒
 * @param {number} noteId 便签ID（cancelNoteAuto 时需要）
 */
export async function cancelTimeBlockReminder(timeBlockId, cancelNoteAuto = false, noteId = null) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return
  }

  if (!database.isReady()) {
    return
  }

  try {
    // 取消单个时间块提醒
    await database.run(
      `UPDATE reminders SET status = 'cancelled', updated_at = datetime('now') WHERE target_type = 'time_block' AND target_id = ? AND status = 'pending';`,
      [timeBlockId]
    )
    console.log('[Reminder] 时间块提醒已取消:', timeBlockId)

    // 如果选择同时取消便签的自动提醒
    if (cancelNoteAuto && noteId) {
      await database.run(
        `UPDATE notes SET auto_remind = 0, updated_at = datetime('now') WHERE id = ?;`,
        [noteId]
      )
      // 取消该便签所有未来的自动提醒
      await database.run(
        `UPDATE reminders SET status = 'cancelled', updated_at = datetime('now') WHERE note_id = ? AND is_auto = 1 AND status = 'pending';`,
        [noteId]
      )
      console.log('[Reminder] 便签自动提醒已关闭:', noteId)
    }

  } catch (err) {
    console.error('[Reminder] 取消提醒失败:', err)
  }
}

/**
 * 检查便签是否开启了自动提醒
 *
 * @param {number} noteId 便签ID
 * @returns {Object|null} { auto_remind, default_advance_minutes }
 */
export async function checkNoteAutoRemind(noteId) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return null
  }

  if (!database.isReady()) {
    return null
  }

  try {
    const result = await database.query(
      `SELECT auto_remind, default_advance_minutes FROM notes WHERE id = ? AND deleted_at IS NULL;`,
      [noteId]
    )
    return result.length > 0 ? result[0] : null
  } catch (err) {
    console.error('[Reminder] 检查便签自动提醒失败:', err)
    return null
  }
}

/**
 * 设置便签自动提醒
 *
 * @param {number} noteId 便签ID
 * @param {boolean} autoRemind 是否开启自动提醒
 * @param {number} advanceMinutes 默认提前分钟数
 */
export async function setNoteAutoRemind(noteId, autoRemind, advanceMinutes = 5) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return
  }

  if (!database.isReady()) {
    return
  }

  try {
    await database.run(
      `UPDATE notes SET auto_remind = ?, default_advance_minutes = ?, updated_at = datetime('now') WHERE id = ?;`,
      [autoRemind ? 1 : 0, advanceMinutes, noteId]
    )
    console.log('[Reminder] 便签自动提醒已设置:', noteId, autoRemind ? '开启' : '关闭')
  } catch (err) {
    console.error('[Reminder] 设置便签自动提醒失败:', err)
  }
}

/**
 * 获取时间块是否有待提醒
 *
 * @param {number} timeBlockId 时间块ID
 * @returns {Object|null} 提醒信息
 */
export async function getTimeBlockReminder(timeBlockId) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return null
  }

  if (!database.isReady()) {
    return null
  }

  try {
    const result = await database.query(
      `SELECT * FROM reminders WHERE target_type = 'time_block' AND target_id = ? AND status = 'pending' LIMIT 1;`,
      [timeBlockId]
    )
    return result.length > 0 ? result[0] : null
  } catch (err) {
    console.error('[Reminder] 获取时间块提醒失败:', err)
    return null
  }
}

/**
 * 关闭提醒
 *
 * @param {number} reminderId 提醒ID
 */
export async function dismissReminder(reminderId) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return
  }

  if (!database.isReady()) {
    return
  }

  try {
    await database.run(
      `UPDATE reminders SET status = 'dismissed', dismissed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?;`,
      [reminderId]
    )
    console.log('[Reminder] 提醒已关闭:', reminderId)
  } catch (err) {
    console.error('[Reminder] 关闭提醒失败:', err)
  }
}

/**
 * 获取待触发的提醒列表
 *
 * @returns {Array} 提醒列表
 */
export async function getPendingReminders() {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return []
  }

  if (!database.isReady()) {
    console.warn('[Reminder] 数据库未就绪,无法获取提醒列表')
    return []
  }

  try {
    const reminders = await database.query(
      `SELECT * FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY remind_at ASC;`,
      [getUserId()]
    )
    return reminders
  } catch (err) {
    console.error('[Reminder] 获取提醒列表失败:', err)
    // 如果是表不存在的错误,抛出错误让上层处理
    if (err.message && err.message.includes('no such table')) {
      throw new Error('提醒表不存在,请重新初始化数据库')
    }
    // 其他错误返回空数组
    return []
  }
}

/**
 * 获取已触发的提醒列表（未关闭）
 *
 * @returns {Array} 提醒列表
 */
export async function getTriggeredReminders() {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return []
  }

  if (!database.isReady()) {
    return []
  }

  try {
    const reminders = await database.query(
      `SELECT * FROM reminders WHERE user_id = ? AND status = 'triggered' ORDER BY triggered_at DESC;`,
      [getUserId()]
    )
    return reminders
  } catch (err) {
    console.error('[Reminder] 获取已触发提醒失败:', err)
    return []
  }
}

/**
 * 时间块更新后同步其提醒
 *
 * 当时间块的开始时间/日期发生变化时，取消旧的 pending 提醒并重新创建。
 * 若不存在 pending 提醒，则不自动新建，尊重手动提醒流程。
 *
 * @param {Object} timeBlock 更新后的时间块（前端格式）
 */
export async function syncReminderAfterTimeBlockUpdate(timeBlock) {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    return
  }

  if (!database.isReady()) {
    console.warn('[Reminder] 数据库未就绪，无法同步提醒')
    return
  }

  try {
    // 查询该时间块最新的 pending 提醒
    const existing = await database.query(
      `SELECT * FROM reminders WHERE target_type = 'time_block' AND target_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1;`,
      [timeBlock.id]
    )

    if (existing.length === 0) {
      return
    }

    const reminder = existing[0]

    // 取消旧提醒
    await cancelTimeBlockReminder(timeBlock.id)
    console.log('[Reminder] 时间块更新，已取消旧提醒:', timeBlock.id)

    // 使用原参数重新创建提醒
    const result = await createTimeBlockReminder(
      timeBlock,
      reminder.advance_minutes,
      reminder.is_auto === 1,
      reminder.note_id
    )

    if (result) {
      console.log('[Reminder] 时间块更新，已重建提醒:', timeBlock.id)
    } else {
      console.log('[Reminder] 时间块更新，新提醒时间已过去，未重建:', timeBlock.id)
    }
  } catch (err) {
    console.error('[Reminder] 同步时间块提醒失败:', err)
  }
}

export default {
  initReminderService,
  stopReminderService,
  createTimeBlockReminder,
  cancelTimeBlockReminder,
  dismissReminder,
  getPendingReminders,
  getTriggeredReminders,
  checkNoteAutoRemind,
  setNoteAutoRemind,
  getTimeBlockReminder,
  syncReminderAfterTimeBlockUpdate
}