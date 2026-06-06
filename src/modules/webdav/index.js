/**
 * WebDAV 模块入口
 * 统一导出所有子模块的公共 API，作为外部唯一交互点
 *
 * 使用示例：
 *   const webdav = require('./webdav');
 *
 *   // 配置管理
 *   await webdav.saveConfig({ serverUrl, username, password });
 *   const config = await webdav.getConfig();
 *
 *   // 连接测试
 *   const result = await webdav.testConnection();
 *
 *   // 手动同步
 *   const syncResult = await webdav.sync({
 *     dataProvider: myDataProvider,
 *     dataWriter: myDataWriter,
 *   });
 *
 *   // 自动同步
 *   webdav.startAutoSync({ dataProvider: myDataProvider });
 *   webdav.stopAutoSync();
 *
 *   // 同步历史
 *   const history = await webdav.getSyncHistory({ page: 1, pageSize: 20 });
 */

'use strict';

// ==================== 子模块引入 ====================
const { WebDAVClient } = require('./client');
const configManager = require('./config');
const { syncEngine } = require('./sync-engine');
const { autoSync } = require('./auto-sync');
const syncHistoryManager = require('./sync-history');
const conflictResolver = require('./conflict-resolver');

// 类型与常量（供外部引用）
const types = require('./types');
const encryptUtils = require('./encrypt');

// ==================== 配置相关 API ====================

/**
 * 保存 WebDAV 配置
 * @param {Object} config - 配置对象 { serverUrl, username, password, syncInterval?, syncDirectory? }
 * @returns {Promise<Object>} - 保存后的脱敏配置
 */
async function saveConfig(config) {
  return configManager.saveConfig(config);
}

/**
 * 获取当前 WebDAV 配置（密码已隐藏）
 * @returns {Promise<Object|null>}
 */
async function getConfig() {
  return configManager.getConfig();
}

/**
 * 删除 WebDAV 配置
 * @returns {Promise<void>}
 */
async function deleteConfig() {
  return configManager.deleteConfig();
}

/**
 * 检查是否已配置 WebDAV
 * @returns {Promise<boolean>}
 */
async function isConfigured() {
  return configManager.isConfigured();
}

// ==================== 连接测试 API ====================

/**
 * 测试 WebDAV 连接
 * @returns {Promise<{ success: boolean, message: string, latency?: number }>}
 */
async function testConnection() {
  const config = await configManager.getConfigWithPassword();
  if (!config) {
    return {
      success: false,
      message: '请先配置 WebDAV 账号信息',
    };
  }

  const client = new WebDAVClient(config);
  try {
    const result = await client.testConnection();
    return result;
  } finally {
    client.disconnect();
  }
}

// ==================== 手动同步 API ====================

/**
 * 执行手动同步
 * @param {Object} options
 * @param {Function} options.dataProvider - 数据提供者 () => Promise<{ categories, timeBlocks }>
 * @param {Function} [options.dataWriter] - 数据写入者 (data) => Promise<void>
 * @param {string} [options.direction='bidirectional'] - 同步方向
 * @param {string} [options.conflictStrategy='merge'] - 冲突解决策略
 * @returns {Promise<Object>} - 同步结果
 */
async function sync(options) {
  return syncEngine.sync(options);
}

/**
 * 取消当前正在进行的同步
 * @returns {Promise<void>}
 */
async function cancelSync() {
  return syncEngine.cancel();
}

/**
 * 检查是否有同步正在进行
 * @returns {boolean}
 */
function isSyncing() {
  return syncEngine.isSyncing;
}

// ==================== 自动同步 API ====================

/**
 * 启动自动同步
 * @param {Object} options
 * @param {Function} options.dataProvider - 数据提供者
 * @param {Function} [options.dataWriter] - 数据写入者
 * @param {number} [options.intervalMin] - 同步间隔（分钟）
 * @returns {Promise<void>}
 */
async function startAutoSync(options) {
  return autoSync.start(options);
}

/**
 * 停止自动同步
 * @returns {void}
 */
function stopAutoSync() {
  autoSync.stop();
}

/**
 * 更新自动同步间隔
 * @param {number} intervalMin - 新间隔（分钟）
 * @returns {void}
 */
function updateSyncInterval(intervalMin) {
  autoSync.updateInterval(intervalMin);
}

/**
 * 立即触发一次自动同步
 * @returns {Promise<Object>}
 */
async function triggerSyncNow() {
  return autoSync.triggerNow();
}

/**
 * 自动同步是否在运行
 * @returns {boolean}
 */
function isAutoSyncRunning() {
  return autoSync.isRunning;
}

// ==================== 同步历史 API ====================

/**
 * 分页获取同步历史
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.pageSize=20]
 * @param {string} [options.status]
 * @returns {Promise<{ items: Array, pagination: Object }>}
 */
async function getSyncHistory(options) {
  return syncHistoryManager.getHistory(options);
}

/**
 * 获取最近 N 条同步记录
 * @param {number} [count=10]
 * @returns {Promise<Array>}
 */
async function getRecentSyncRecords(count) {
  return syncHistoryManager.getRecentRecords(count);
}

/**
 * 根据同步ID查询同步状态
 * @param {string} syncId
 * @returns {Promise<Object|null>}
 */
async function getSyncStatus(syncId) {
  return syncHistoryManager.getRecordBySyncId(syncId);
}

/**
 * 清空同步历史
 * @returns {Promise<void>}
 */
async function clearSyncHistory() {
  return syncHistoryManager.clearHistory();
}

// ==================== 导出 ====================

module.exports = {
  // ---- 快捷 API ----
  saveConfig,
  getConfig,
  deleteConfig,
  isConfigured,
  testConnection,
  sync,
  cancelSync,
  isSyncing,
  startAutoSync,
  stopAutoSync,
  updateSyncInterval,
  triggerSyncNow,
  isAutoSyncRunning,
  getSyncHistory,
  getRecentSyncRecords,
  getSyncStatus,
  clearSyncHistory,

  // ---- 子模块（高级用法）----
  WebDAVClient,
  syncEngine,
  autoSync,
  configManager,
  syncHistoryManager,
  conflictResolver,

  // ---- 工具 & 类型 ----
  types,
  encrypt: encryptUtils,
};
