/**
 * 配置验证工具
 * 验证 WebDAV 连接配置的合法性和完整性
 */

'use strict';

const { WebDAVErrorCodes } = require('../types');

/**
 * 验证 WebDAV 配置对象的完整性和合法性
 * @param {Object} config - WebDAV 配置对象
 * @param {string} config.serverUrl - 服务器地址
 * @param {string} config.username - 用户名
 * @param {string} config.password - 密码
 * @param {number} [config.syncInterval] - 同步间隔（分钟）
 * @returns {{ valid: boolean, errors: string[] }} - 验证结果
 */
function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['配置不能为空'] };
  }

  // serverUrl 验证
  if (!config.serverUrl || typeof config.serverUrl !== 'string' || config.serverUrl.trim() === '') {
    errors.push('服务器地址不能为空');
  } else {
    try {
      const url = new URL(config.serverUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.push('服务器地址协议必须是 http 或 https');
      }
    } catch {
      errors.push('服务器地址格式无效，请输入有效的 URL');
    }
  }

  // username 验证
  if (!config.username || typeof config.username !== 'string' || config.username.trim() === '') {
    errors.push('用户名不能为空');
  }

  // password 验证
  if (!config.password || typeof config.password !== 'string' || config.password.trim() === '') {
    errors.push('密码不能为空');
  }

  // syncInterval 验证（可选字段）
  if (config.syncInterval !== undefined && config.syncInterval !== null) {
    if (typeof config.syncInterval !== 'number' || !Number.isInteger(config.syncInterval)) {
      errors.push('同步间隔必须为整数');
    } else if (config.syncInterval < 5 || config.syncInterval > 1440) {
      errors.push('同步间隔必须在 5 ~ 1440 分钟之间');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 规范化服务器 URL
 * 确保路径以 / 结尾
 * @param {string} url - 原始 URL
 * @returns {string} - 规范化后的 URL
 */
function normalizeServerUrl(url) {
  if (!url) return url;
  let normalized = url.trim();
  // 移除末尾斜杠后重新添加，确保只有一个
  normalized = normalized.replace(/\/+$/, '');
  return normalized + '/';
}

/**
 * 从完整配置中提取安全的显示信息（脱敏密码）
 * @param {Object} config - 完整配置
 * @returns {Object} - 脱敏后的配置（password 字段隐藏）
 */
function sanitizeConfigForDisplay(config) {
  if (!config) return null;
  const { password, ...safeConfig } = config;
  return {
    ...safeConfig,
    password: password ? '******' : undefined,
  };
}

module.exports = {
  validateConfig,
  normalizeServerUrl,
  sanitizeConfigForDisplay,
};
