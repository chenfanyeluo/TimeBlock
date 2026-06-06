/**
 * WebDAV 模块类型定义与常量
 * 包含同步状态、冲突解决策略、数据格式等枚举和接口定义
 */

'use strict';

// ==================== 同步状态枚举 ====================
const SyncStatus = {
  PENDING: 'pending',         // 等待中
  IN_PROGRESS: 'in_progress', // 同步中
  COMPLETED: 'completed',     // 已完成
  FAILED: 'failed',           // 失败
  CANCELLED: 'cancelled',     // 已取消
};

// ==================== 冲突解决策略枚举 ====================
const ConflictStrategy = {
  KEEP_LOCAL: 'keep_local',   // 保留本地
  KEEP_REMOTE: 'keep_remote', // 保留云端
  MERGE: 'merge',             // 合并（保留较新）
  SKIP: 'skip',               // 跳过
};

// ==================== 同步方向枚举 ====================
const SyncDirection = {
  UPLOAD: 'upload',           // 上传（本地 → 云端）
  DOWNLOAD: 'download',       // 下载（云端 → 本地）
  BIDIRECTIONAL: 'bidirectional', // 双向同步
};

// ==================== 数据文件名常量 ====================
const DataFiles = {
  CATEGORIES: 'categories.json',
  TIME_BLOCKS: 'time_blocks.json',
  SYNC_META: '.sync_meta.json',    // 同步元数据（最后同步时间、版本等）
  LOCK_FILE: '.sync.lock',         // 同步锁文件，防止多端并发
};

// ==================== 默认配置值 ====================
const Defaults = {
  SYNC_INTERVAL_MIN: 30,            // 默认同步间隔（分钟）
  SYNC_INTERVAL_MIN_LIMIT: 5,       // 最小同步间隔（分钟）
  SYNC_INTERVAL_MAX_LIMIT: 1440,    // 最大同步间隔（分钟，24小时）
  CONNECT_TIMEOUT_MS: 15000,        // 连接超时时间（毫秒）
  RETRY_COUNT: 3,                   // 默认重试次数
  RETRY_DELAY_MS: 2000,             // 重试间隔（毫秒）
  DATA_FILE_VERSION: '1.0',         // 数据文件格式版本
};

// ==================== 错误码 ====================
const WebDAVErrorCodes = {
  CONFIG_NOT_FOUND: 'WEBDAV_CONFIG_NOT_FOUND',
  CONNECTION_FAILED: 'WEBDAV_CONNECTION_FAILED',
  AUTH_FAILED: 'WEBDAV_AUTH_FAILED',
  NOT_FOUND: 'WEBDAV_NOT_FOUND',
  PERMISSION_DENIED: 'WEBDAV_PERMISSION_DENIED',
  SYNC_IN_PROGRESS: 'WEBDAV_SYNC_IN_PROGRESS',
  CONFLICT_DETECTED: 'WEBDAV_CONFLICT_DETECTED',
  ENCRYPTION_ERROR: 'WEBDAV_ENCRYPTION_ERROR',
  INVALID_CONFIG: 'WEBDAV_INVALID_CONFIG',
  NETWORK_ERROR: 'WEBDAV_NETWORK_ERROR',
  TIMEOUT: 'WEBDAV_TIMEOUT',
  LOCK_ACQUISITION_FAILED: 'WEBDAV_LOCK_FAILED',
};

module.exports = {
  SyncStatus,
  ConflictStrategy,
  SyncDirection,
  DataFiles,
  Defaults,
  WebDAVErrorCodes,
};
