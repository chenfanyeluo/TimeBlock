/**
 * 时间块 API
 *
 * 时间块的 CRUD 和搜索操作
 */

import client from './client'

/**
 * 获取时间块列表（分页）
 *
 * @param {Object} params 查询参数
 * @param {string} params.startDate 开始日期
 * @param {string} params.endDate 结束日期
 * @param {number} params.noteId 便签ID
 * @param {number} params.page 页码
 * @param {number} params.pageSize 每页数量
 * @returns {Promise<{ items, pagination }>}
 */
export async function getTimeBlocks(params = {}) {
  const response = await client.get('/time-blocks', params)

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '获取时间块列表失败')
}

/**
 * 搜索时间块
 *
 * @param {Object} params 搜索参数
 * @param {string} params.keyword 关键字（搜索标题和描述）
 * @param {string} params.startDate 开始日期
 * @param {string} params.endDate 结束日期
 * @param {number} params.noteId 便签ID
 * @returns {Promise<Array>} 搜索结果列表
 */
export async function searchTimeBlocks(params = {}) {
  const response = await client.get('/time-blocks/search', params)

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '搜索时间块失败')
}

/**
 * 创建时间块
 *
 * @param {Object} data 时间块数据
 * @returns {Promise<Object>} 创建的时间块
 */
export async function createTimeBlock(data) {
  const response = await client.post('/time-blocks', data)

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '创建时间块失败')
}

/**
 * 更新时间块
 *
 * @param {number} id 时间块ID
 * @param {Object} data 更新数据
 * @returns {Promise<Object>} 更新后的时间块
 */
export async function updateTimeBlock(id, data) {
  const response = await client.put(`/time-blocks/${id}`, data)

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '更新时间块失败')
}

/**
 * 删除时间块
 *
 * @param {number} id 时间块ID
 * @returns {Promise<void>}
 */
export async function deleteTimeBlock(id) {
  const response = await client.del(`/time-blocks/${id}`)

  if (response.success) {
    return
  }

  throw new Error(response.message || '删除时间块失败')
}

export default {
  getTimeBlocks,
  searchTimeBlocks,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock
}