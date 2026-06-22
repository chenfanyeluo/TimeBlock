/**
 * 时间工具函数模块
 *
 * 提供时间块相关的常用计算和转换功能，
 * 统一项目中分散的时长计算逻辑。
 *
 * @module server/utils/timeUtils
 */

/**
 * 计算时间块时长（秒）
 *
 * @param {Date|string|number} startTime 开始时间
 * @param {Date|string|number} endTime 结束时间
 * @returns {number} 时长（秒）
 * @throws {Error} 当时间参数无效或结束时间早于开始时间时抛出异常
 */
function durationInSeconds(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('无效的时间参数')
  }

  if (end < start) {
    throw new Error('结束时间不能早于开始时间')
  }

  return Math.floor((end - start) / 1000)
}

/**
 * 格式化时长为人类可读格式
 *
 * @param {number} seconds 时长（秒）
 * @returns {string} 格式化后的时长字符串，如 "1小时30分钟"
 */
function formatDuration(seconds) {
  if (seconds < 0) {
    throw new Error('时长不能为负数')
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`)

  return parts.join('')
}

/**
 * 验证时间块的时间范围是否有效
 *
 * @param {Date|string|number} startTime 开始时间
 * @param {Date|string|number} endTime 结束时间
 * @returns {boolean} 是否有效
 */
function isValidTimeRange(startTime, endTime) {
  try {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start
  } catch {
    return false
  }
}

module.exports = {
  durationInSeconds,
  formatDuration,
  isValidTimeRange
}
