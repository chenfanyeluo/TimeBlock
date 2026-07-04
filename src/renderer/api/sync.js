/**
 * 数据同步 API
 *
 * 客户端与云端数据同步操作
 */

import client from './client'

/**
 * 上传本地变更到云端
 *
 * @param {Object} changes - 变更数据
 * @param {Object} changes.notes - 便签变更列表
 * @param {Object} changes.timeBlocks - 时间块变更列表
 * @param {string} lastSyncAt - 上次同步时间
 * @param {string} deviceId - 设备标识
 * @returns {Promise<{ synced, syncId, serverTime }>}
 */
export async function uploadChanges(changes, lastSyncAt = null, deviceId = 'web-client') {
  const response = await client.post('/sync/upload', {
    changes,
    lastSyncAt,
    deviceId
  })

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '数据上传失败')
}

/**
 * 从云端下载变更
 *
 * @param {string} lastSyncAt - 上次同步时间（可选，不传则下载全部）
 * @returns {Promise<{ serverTime, notes, timeBlocks }>}
 */
export async function downloadChanges(lastSyncAt = null) {
  const params = lastSyncAt ? { lastSyncAt } : {}
  const response = await client.get('/sync/download', params)

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '数据下载失败')
}

/**
 * 获取同步状态
 *
 * @returns {Promise<{ lastSyncAt, lastSyncId, totalSyncs, failedSyncs, isOnline }>}
 */
export async function getSyncStatus() {
  const response = await client.get('/sync/status')

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '获取同步状态失败')
}

/**
 * 获取同步日志列表
 *
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @returns {Promise<{ items, pagination }>}
 */
export async function getSyncLogs(page = 1, pageSize = 20) {
  const response = await client.get('/sync/logs', { page, pageSize })

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '获取同步日志失败')
}

/**
 * 刷新统计汇总数据
 *
 * @param {string} date - 目标日期（YYYY-MM-DD）
 * @returns {Promise<{ date, totalNotes, totalSeconds }>}
 */
export async function refreshStatistics(date = null) {
  const response = await client.post('/sync/statistics/refresh', { date })

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '刷新统计失败')
}

/**
 * 执行完整同步（上传 + 下载）
 *
 * @param {Object} localData - 本地数据
 * @param {string} lastSyncAt - 上次同步时间
 * @returns {Promise<{ uploaded, downloaded, serverTime }>}
 */
export async function fullSync(localData, lastSyncAt = null) {
  // 1. 上传本地变更
  const uploadResult = await uploadChanges(localData, lastSyncAt)

  // 2. 下载云端变更
  const downloadResult = await downloadChanges(uploadResult.serverTime)

  return {
    uploaded: uploadResult.synced,
    downloaded: {
      notes: downloadResult.notes?.length || 0,
      timeBlocks: downloadResult.timeBlocks?.length || 0
    },
    serverTime: downloadResult.serverTime,
    data: downloadResult
  }
}

export default {
  uploadChanges,
  downloadChanges,
  getSyncStatus,
  getSyncLogs,
  refreshStatistics,
  fullSync
}