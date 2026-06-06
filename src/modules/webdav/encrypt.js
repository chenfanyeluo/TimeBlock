/**
 * 加密/解密工具模块
 * 使用 AES-256-GCM 算法加密敏感信息（WebDAV密码等）
 * 基于 Node.js crypto 内置模块，无需额外依赖
 */

'use strict';

const crypto = require('crypto');

// 算法配置
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;   // 256 bits
const IV_LENGTH = 16;    // 128 bits
const TAG_LENGTH = 16;   // GCM authentication tag length

/**
 * 派生加密密钥
 * 从主密钥和盐值派生固定长度的加密密钥
 * @param {string} password - 主密码/口令
 * @param {string|Buffer} salt - 盐值（应为随机生成并安全存储）
 * @param {number} [iterations=100000] - PBKDF2 迭代次数
 * @returns {Buffer} - 256位加密密钥
 */
function deriveKey(password, salt, iterations = 100000) {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
}

/**
 * 加密明文
 * @param {string} plaintext - 待加密的明文
 * @param {string} encryptionKey - 加密密钥（应从安全位置获取，如用户主密码或机器指纹）
 * @returns {string} - Base64 编码的加密结果（格式：base64(iv) : base64(tag) : base64(ciphertext)）
 */
function encrypt(plaintext, encryptionKey) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('[WebDAV-Encrypt] 加密失败：明文必须为非空字符串');
  }
  if (!encryptionKey || typeof encryptionKey !== 'string') {
    throw new Error('[WebDAV-Encrypt] 加密失败：加密密钥必须为非空字符串');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(encryptionKey, iv); // 使用 IV 作为盐值
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // 格式：iv:tag:ciphertext（均 Base64 编码）
  return [iv.toString('base64'), tag.toString('base64'), encrypted].join(':');
}

/**
 * 解密密文
 * @param {string} ciphertext - encrypt() 返回的加密字符串
 * @param {string} encryptionKey - 加密密钥（需与加密时一致）
 * @returns {string} - 解密后的明文
 */
function decrypt(ciphertext, encryptionKey) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('[WebDAV-Encrypt] 解密失败：密文必须为非空字符串');
  }
  if (!encryptionKey || typeof encryptionKey !== 'string') {
    throw new Error('[WebDAV-Encrypt] 解密失败：加密密钥必须为非空字符串');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('[WebDAV-Encrypt] 解密失败：密文格式无效');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];

  const key = deriveKey(encryptionKey, iv);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted;
  try {
    decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
  } catch (err) {
    throw new Error(`[WebDAV-Encrypt] 解密失败：${err.message}（可能密钥不匹配或数据被篡改）`);
  }

  return decrypted;
}

/**
 * 生成随机加密密钥
 * 用于为每个用户/设备生成独立的加密主密钥
 * @param {number} [length=32] - 密钥长度（字节）
 * @returns {string} - 十六进制编码的随机密钥
 */
function generateRandomKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 计算数据的 SHA256 哈希值
 * 用于校验数据完整性及检测变更
 * @param {string|Object} data - 待计算哈希的数据（对象会先 JSON 序列化）
 * @returns {string} - 十六进制哈希值
 */
function hashData(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  generateRandomKey,
  hashData,
};
