/**
 * 同步历史记录管理模块
 * 负责同步操作的日志记录、查询和清理
 * 数据存储在本地 JSON 文件中（userData/webdav-sync-history.json）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { SyncStatus } = require('./types');
const logger = require('./utils/logger');

// ==================== 常量 ====================

const HISTORY_FILE_NAME = 'webdav-sync-history.json';
/** 最大保留的历史记录数 */
const MAX_HISTORY_RECORDS = 200;

// ==================== 内部方法 ====================

/**
 * 获取历史文件路径
 * @returns {string}
 */
function getHistoryFilePath() {
  return path.join(app.getPath('userData'), HISTORY_FILE_NAME);
}

/**
 * 读取所有历史记录
 * @returns {Array<Object>}
 */
function _readAllRecords() {
  const filePath = getHistoryFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(data);
    if (!Array.isArray(records)) {
      logger.warn('同步历史文件格式异常，将重置');
      return [];
    }
    return records;
  } catch (err) {
    logger.error(`读取同步历史失败: ${err.message}`);
    return [];
  }
}

/**
 * 写入所有历史记录（原子操作）
 * @param {Array<Object>} records
 * @returns {void}
 */
function _writeAllRecords(records) {
  const filePath = getHistoryFilePath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 原子写入
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ==================== 公共 API ====================

/**
 * 创建一条新的同步历史记录
 * @param {Object} params
 * @param {string} params.syncId - 同步ID
 * @param {string} [params.status='pending'] - 初始状态
 * @returns {Promise<Object>} - 创建的记录对象
 */
async function createRecord(params) {
  const record = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    syncId: params.syncId,
    status: params.status || SyncStatus.PENDING,
    startedAt: new Date().toISOString(),
    completedAt: null,
    uploaded: 0,
    downloaded: 0,
    conflicts: 0,
    errorMessage: null,
  };

  const records = _readAllRecords();
  records.unshift(record); // 新记录插入到最前面

  // 限制最大条数，超出则裁剪末尾旧记录
  if (records.length > MAX_HISTORY_RECORDS) {
    records.length = MAX_HISTORY_RECORDS;
  }

  _writeAllRecords(records);
  logger.debug(`创建同步历史记录: ${record.id} (syncId=${record.syncId})`);
  return record;
}

/**
 * 更新同步历史记录
 * @param {string} syncId - 同步ID
 * @param {Object} updates - 要更新的字段
 * @param {string} [updates.status] - 新状态
 * @param {string} [updates.completedAt] - 完成时间
 * @param {number} [updates.uploaded] - 上传数量
 * @param {number} [updates.downloaded] - 下载数量
 * @param {number} [updates.conflicts] - 冲突数量
 * @param {string} [updates.errorMessage] - 错误信息
 * @returns {Promise<Object|null>} - 更新后的记录，未找到返回 null
 */
async function updateRecord(syncId, updates) {
  const records = _readAllRecords();
  const index = records.findIndex(r => r.syncId === syncId);

  if (index === -1) {
    logger.warn(`未找到同步历史记录: syncId=${syncId}`);
    return null;
  }

  // 合并更新字段
  Object.assign(records[index], updates);
  _writeAllRecords(records);

  logger.debug(`更新同步历史记录: syncId=${syncId}, status=${updates.status}`);
  return records[index];
}

/**
 * 根据同步ID获取单条历史记录
 * @param {string} syncId - 同步ID
 * @returns {Promise<Object|null>}
 */
async function getRecordBySyncId(syncId) {
  const records = _readAllRecords();
  return records.find(r => r.syncId === syncId) || null;
}

/**
 * 分页查询同步历史
 * @param {Object} [options]
 * @param {number} [options.page=1] - 页码（从1开始）
 * @param {number} [options.pageSize=20] - 每页数量
 * @param {string} [options.status] - 按状态筛选
 * @returns {Promise<{ items: Array, pagination: { page, pageSize, total, totalPages } }>}
 */
async function getHistory(options = {}) {
  let records = _readAllRecords();

  // 状态筛选
  if (options.status) {
    records = records.filter(r => r.status === options.status);
  }

  const total = records.length;
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 20));
  const totalPages = Math.ceil(total / pageSize);

  // 分页截取
  const startIndex = (page - 1) * pageSize;
  const items = records.slice(startIndex, startIndex + pageSize);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * 获取最近的 N 条同步记录
 * @param {number} [count=10] - 返回的记录数
 * @returns {Promise<Array<Object>>}
 */
async function getRecentRecords(count = 10) {
  const records = _readAllRecords();
  return records.slice(0, count);
}

/**
 * 清除所有同步历史记录
 * @returns {Promise<void>}
 */
async function clearHistory() {
  _writeAllRecords([]);
  logger.info('同步历史记录已清空');
}

/**
 * 清理超过指定天数的旧记录，同时确保总数不超过上限
 * 清理优先级：先按天数淘汰，若仍超上限则按时间从旧到新继续裁剪
 * @param {number} [days=30] - 保留天数
 * @returns {Promise<number>} - 清理的记录数
 */
async function cleanupOldRecords(days = 30) {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  let records = _readAllRecords();
  const originalLength = records.length;

  // 第一轮：按天数过滤
  let filtered = records.filter(r => {
    const startedAt = new Date(r.startedAt).getTime();
    return startedAt > cutoffTime;
  });

  // 第二轮：若仍超过数量上限，从最旧的开始裁剪
  if (filtered.length > MAX_HISTORY_RECORDS) {
    const excessCount = filtered.length - MAX_HISTORY_RECORDS;
    filtered = filtered.slice(excessCount); // 数组已按时间倒序(新的在前)，裁尾部即裁最旧
    logger.info(
      `天数过滤后仍剩 ${filtered.length + excessCount} 条，额外裁剪 ${excessCount} 条以满足 ${MAX_HISTORY_RECORDS} 上限`
    );
  }

  const removedCount = originalLength - filtered.length;
  _writeAllRecords(filtered);

  if (removedCount > 0) {
    logger.info(`已清理 ${removedCount} 条同步历史记录（保留最近 ${days} 天，上限 ${MAX_HISTORY_RECORDS} 条）`);
  }

  return removedCount;
}

module.exports = {
  createRecord,
  updateRecord,
  getRecordBySyncId,
  getHistory,
  getRecentRecords,
  clearHistory,
  cleanupOldRecords,
};
