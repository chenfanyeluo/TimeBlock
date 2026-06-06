/**
 * WebDAV 配置管理模块
 * 负责配置的存储、读取、加密/解密、验证等
 * 配置存储位置：Electron app.getPath('userData') 下的 webdav-config.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { encrypt, decrypt, generateRandomKey, hashData } = require('./encrypt');
const { validateConfig, normalizeServerUrl, sanitizeConfigForDisplay } = require('./utils/validator');
const { Defaults, WebDAVErrorCodes } = require('./types');
const logger = require('./utils/logger');

// ==================== 内部状态 ====================

/** @type {Object|null} 内存中的配置缓存 */
let _cachedConfig = null;

/** 加密密钥文件名 */
const KEY_FILE_NAME = '.webdav-key';
const CONFIG_FILE_NAME = 'webdav-config.json';

/**
 * 获取配置存储目录
 * @returns {string} - 配置目录绝对路径
 */
function getConfigDir() {
  return app.getPath('userData');
}

/**
 * 获取加密密钥文件完整路径
 * @returns {string}
 */
function getKeyFilePath() {
  return path.join(getConfigDir(), KEY_FILE_NAME);
}

/**
 * 获取配置文件完整路径
 * @returns {string}
 */
function getConfigFilePath() {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

// ==================== 密钥管理 ====================

/**
 * 获取或创建加密主密钥
 * 每个设备/用户拥有独立的加密主密钥，存储在 userData 目录下
 * @returns {string} - 加密主密钥
 */
function getOrCreateEncryptionKey() {
  const keyPath = getKeyFilePath();

  if (fs.existsSync(keyPath)) {
    try {
      const keyData = fs.readFileSync(keyPath, 'utf8').trim();
      logger.debug('从本地加载加密密钥');
      return keyData;
    } catch (err) {
      logger.error(`读取加密密钥失败: ${err.message}，将重新生成`);
    }
  }

  // 生成新密钥并保存
  const newKey = generateRandomKey();
  try {
    fs.writeFileSync(keyPath, newKey, 'utf8');
    logger.info('已生成新的加密密钥');
  } catch (err) {
    logger.error(`保存加密密钥失败: ${err.message}`);
  }
  return newKey;
}

// ==================== 配置 CRUD ====================

/**
 * 获取当前 WebDAV 配置（脱敏）
 * @returns {Promise<Object|null>} - 配置对象（password 已隐藏），未配置返回 null
 */
async function getConfig() {
  // 优先使用内存缓存
  if (_cachedConfig) {
    return sanitizeConfigForDisplay(_cachedConfig);
  }

  const configPath = getConfigFilePath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const encryptedData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const encryptionKey = getOrCreateEncryptionKey();

    // 解密敏感字段
    const config = {
      id: encryptedData.id,
      serverUrl: encryptedData.serverUrl,
      username: encryptedData.username,
      password: encryptedData.passwordEncrypted
        ? decrypt(encryptedData.passwordEncrypted, encryptionKey)
        : '',
      syncInterval: encryptedData.syncInterval ?? Defaults.SYNC_INTERVAL_MIN,
      syncDirectory: encryptedData.syncDirectory || '/TimeBlock',
      lastSyncAt: encryptedData.lastSyncAt || null,
      createdAt: encryptedData.createdAt || null,
      updatedAt: encryptedData.updatedAt || null,
    };

    _cachedConfig = config;
    logger.debug('加载 WebDAV 配置成功');
    return sanitizeConfigForDisplay(config);
  } catch (err) {
    logger.error(`读取 WebDAV 配置失败: ${err.message}`);
    throw Object.assign(new Error('读取配置文件失败'), {
      code: WebDAVErrorCodes.INVALID_CONFIG,
    });
  }
}

/**
 * 获取包含明文密码的完整配置（内部使用）
 * 注意：此方法返回的配置包含明文密码，仅限同步引擎等可信模块调用
 * @returns {Promise<Object|null>}
 */
async function getConfigWithPassword() {
  if (_cachedConfig) {
    return { ..._cachedConfig };
  }

  const configPath = getConfigFilePath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const encryptedData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const encryptionKey = getOrCreateEncryptionKey();

    const config = {
      id: encryptedData.id,
      serverUrl: encryptedData.serverUrl,
      username: encryptedData.username,
      password: encryptedData.passwordEncrypted
        ? decrypt(encryptedData.passwordEncrypted, encryptionKey)
        : '',
      syncInterval: encryptedData.syncInterval ?? Defaults.SYNC_INTERVAL_MIN,
      syncDirectory: encryptedData.syncDirectory || '/TimeBlock',
      lastSyncAt: encryptedData.lastSyncAt || null,
      createdAt: encryptedData.createdAt || null,
      updatedAt: encryptedData.updatedAt || null,
    };

    _cachedConfig = config;
    return { ...config };
  } catch (err) {
    logger.error(`读取完整配置失败: ${err.message}`);
    throw err;
  }
}

/**
 * 保存/更新 WebDAV 配置
 * @param {Object} rawConfig - 原始配置数据
 * @param {string} rawConfig.serverUrl - 服务器地址
 * @param {string} rawConfig.username - 用户名
 * @param {string} rawConfig.password - 密码（明文，将被加密存储）
 * @param {number} [rawConfig.syncInterval] - 同步间隔（分钟）
 * @param {string} [rawConfig.syncDirectory] - 同步目录
 * @returns {Promise<Object>} - 保存后的配置（脱敏）
 */
async function saveConfig(rawConfig) {
  // 验证配置
  const validation = validateConfig(rawConfig);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors.join('; ')), {
      code: WebDAVErrorCodes.INVALID_CONFIG,
      details: validation.errors,
    });
  }

  // 规范化 URL
  const normalizedUrl = normalizeServerUrl(rawConfig.serverUrl);

  // 加密密码
  const encryptionKey = getOrCreateEncryptionKey();
  const passwordEncrypted = encrypt(rawConfig.password, encryptionKey);

  const now = new Date().toISOString();
  const existingConfig = await getConfigWithPassword().catch(() => null);

  const configToSave = {
    id: existingConfig?.id || `wdc_${Date.now()}`,
    serverUrl: normalizedUrl,
    username: rawConfig.username.trim(),
    passwordEncrypted,
    syncInterval: rawConfig.syncInterval ?? Defaults.SYNC_INTERVAL_MIN,
    syncDirectory: (rawConfig.syncDirectory || '/TimeBlock').replace(/\/+$/, ''),
    lastSyncAt: existingConfig?.lastSyncAt || null,
    createdAt: existingConfig?.createdAt || now,
    updatedAt: now,
  };

  const configPath = getConfigFilePath();
  const configDir = path.dirname(configPath);

  // 确保目录存在
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // 写入配置文件（原子写入：先写临时文件再重命名）
  const tmpPath = configPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(configToSave, null, 2), 'utf8');
  fs.renameSync(tmpPath, configPath);

  // 更新内存缓存（含明文密码，供后续使用）
  _cachedConfig = {
    ...configToSave,
    password: rawConfig.password,
  };

  logger.info('WebDAV 配置已保存');
  return sanitizeConfigForDisplay(_cachedConfig);
}

/**
 * 删除 WebDAV 配置
 * 同时清除内存缓存
 * @returns {Promise<void>}
 */
async function deleteConfig() {
  const configPath = getConfigFilePath();

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }

  _cachedConfig = null;
  logger.info('WebDAV 配置已删除');
}

/**
 * 更新最后同步时间
 * @param {string} [syncTime] - ISO 格式的时间字符串，默认为当前时间
 * @returns {Promise<void>}
 */
async function updateLastSyncTime(syncTime) {
  const time = syncTime || new Date().toISOString();
  const config = await getConfigWithPassword();

  if (!config) {
    logger.warn('更新最后同步时间失败：配置不存在');
    return;
  }

  config.lastSyncAt = time;
  config.updatedAt = new Date().toISOString();

  // 持久化
  const configPath = getConfigFilePath();
  const encryptionKey = getOrCreateEncryptionKey();
  const passwordEncrypted = encrypt(config.password, encryptionKey);

  const dataToSave = {
    id: config.id,
    serverUrl: config.serverUrl,
    username: config.username,
    passwordEncrypted,
    syncInterval: config.syncInterval,
    syncDirectory: config.syncDirectory,
    lastSyncAt: config.lastSyncAt,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };

  const tmpPath = configPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(dataToSave, null, 2), 'utf8');
  fs.renameSync(tmpPath, configPath);

  // 同步更新缓存
  _cachedConfig = config;
  logger.debug(`最后同步时间已更新: ${time}`);
}

/**
 * 检查是否已配置 WebDAV
 * @returns {Promise<boolean>}
 */
async function isConfigured() {
  const configPath = getConfigFilePath();
  return fs.existsSync(configPath);
}

module.exports = {
  getConfig,
  getConfigWithPassword,
  saveConfig,
  deleteConfig,
  updateLastSyncTime,
  isConfigured,
};
