/**
 * WebDAV 客户端封装
 * 基于 webdav-client 库提供 WebDAV 服务器操作能力
 * 包括：连接测试、文件/目录操作、上传下载等
 *
 * 依赖: webdav (npm install webdav)
 */

'use strict';

const { createClient } = require('webdav');
const { Defaults, WebDAVErrorCodes } = require('./types');
const logger = require('./utils/logger');

/**
 * 创建 WebDAV 客户端实例
 * @param {Object} config - 连接配置
 * @param {string} config.serverUrl - 服务器地址
 * @param {string} config.username - 用户名
 * @param {string} config.password - 密码
 * @returns {import('webdav').WebDAVClient} - webdav-client 实例
 */
function createWebDAVClient(config) {
  return createClient(config.serverUrl, {
    username: config.username,
    password: config.password,
    timeout: Defaults.CONNECT_TIMEOUT_MS,
  });
}

/**
 * WebDAVClient 类
 * 封装所有与 WebDAV 服务器的交互操作
 */
class WebDAVClient {
  /**
   * @param {Object} config - WebDAV 配置 { serverUrl, username, password }
   */
  constructor(config) {
    this.config = config;
    this._client = createWebDAVClient(config);
    this._connected = false;
  }

  /**
   * 获取底层 webdav-client 实例（供高级用法）
   * @returns {import('webdav').WebDAVClient}
   */
  get raw() {
    return this._client;
  }

  /**
   * 测试连接是否可用
   * 通过尝试获取根目录信息来验证连接和认证
   * @returns {Promise<{ success: boolean, message: string, latency?: number }>}
   */
  async testConnection() {
    const startTime = Date.now();
    try {
      // 尝试访问服务器根目录以验证认证
      await this._client.getDirectoryContents('/');
      const latency = Date.now() - startTime;
      this._connected = true;
      logger.info(`连接测试成功 (${latency}ms): ${this.config.serverUrl}`);
      return {
        success: true,
        message: '连接成功',
        latency,
      };
    } catch (err) {
      this._connected = false;
      const errMsg = err.response?.status === 401
        ? '认证失败，请检查用户名和密码'
        : err.code === 'ECONNREFUSED'
          ? '无法连接到服务器，请检查服务器地址'
          : err.code === 'ENOTFOUND'
            ? 'DNS 解析失败，请检查服务器地址是否正确'
            : err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED'
              ? '连接超时，请检查网络或服务器状态'
              : `连接失败: ${err.message}`;

      logger.error(`连接测试失败: ${errMsg}`);
      return {
        success: false,
        message: errMsg,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查远程目录是否存在，不存在则创建
   * @param {string} remotePath - 远程目录路径
   * @returns {Promise<boolean>} - 是否已存在（false 表示刚创建）
   */
  async ensureDirectory(remotePath) {
    try {
      await this._client.getDirectoryContents(remotePath);
      logger.debug(`远程目录已存在: ${remotePath}`);
      return true; // 已存在
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        // 目录不存在，尝试创建（递归创建父目录）
        const parts = remotePath.split('/').filter(Boolean);
        let currentPath = '';
        for (const part of parts) {
          currentPath += '/' + part;
          try {
            await this._client.createDirectory(currentPath);
          } catch (createErr) {
            // 忽略"已存在"错误（405 Method Not Allowed 或类似）
            if (createErr.status !== 405 && createErr.response?.status !== 405) {
              throw createErr;
            }
          }
        }
        logger.info(`远程目录已创建: ${remotePath}`);
        return false; // 新创建
      }
      throw err;
    }
  }

  /**
   * 检查远程文件是否存在
   * @param {string} remoteFilePath - 远程文件路径
   * @returns {Promise<boolean>}
   */
  async exists(remoteFilePath) {
    try {
      await this._client.stat(remoteFilePath);
      return true;
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * 获取远程文件内容（字符串格式）
   * @param {string} remoteFilePath - 远程文件路径
   * @returns {Promise<string>} - 文件内容字符串
   */
  async getFileContent(remoteFilePath) {
    try {
      const content = await this._client.getFileContents(remoteFilePath, { format: 'text' });
      logger.debug(`读取远程文件成功: ${remoteFilePath}`);
      return content.toString();
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        throw Object.assign(new Error(`远程文件不存在: ${remoteFilePath}`), {
          code: WebDAVErrorCodes.NOT_FOUND,
        });
      }
      throw err;
    }
  }

  /**
   * 获取远程文件的二进制内容（Buffer）
   * @param {string} remoteFilePath - 远程文件路径
   * @returns {Promise<Buffer>}
   */
  async getFileBuffer(remoteFilePath) {
    const buffer = await this._client.getFileContents(remoteFilePath, { format: 'binary' });
    logger.debug(`读取远程文件(Buffer)成功: ${remoteFilePath}`);
    return buffer;
  }

  /**
   * 上传字符串内容到远程文件
   * @param {string} remoteFilePath - 远程目标路径
   * @param {string} content - 文件内容字符串
   * @param {boolean} [overwrite=true] - 是否覆盖已有文件
   * @returns {Promise<void>}
   */
  async putFileContent(remoteFilePath, content, overwrite = true) {
    const buffer = Buffer.from(content, 'utf8');
    await this._client.putFileContents(remoteFilePath, buffer, { overwrite });
    logger.debug(`上传文件成功: ${remoteFilePath} (${buffer.length} bytes)`);
  }

  /**
   * 上传 Buffer 到远程文件
   * @param {string} remoteFilePath - 远程目标路径
   * @param {Buffer} buffer - 文件二进制内容
   * @param {boolean} [overwrite=true] - 是否覆盖已有文件
   * @returns {Promise<void>}
   */
  async putFileBuffer(remoteFilePath, buffer, overwrite = true) {
    await this._client.putFileContents(remoteFilePath, buffer, { overwrite });
    logger.debug(`上传文件(Buffer)成功: ${remoteFilePath} (${buffer.length} bytes)`);
  }

  /**
   * 删除远程文件
   * @param {string} remoteFilePath - 远程文件路径
   * @returns {Promise<void>}
   */
  async deleteFile(remoteFilePath) {
    await this._client.deleteFile(remoteFilePath);
    logger.debug(`删除远程文件成功: ${remoteFilePath}`);
  }

  /**
   * 获取远程文件/目录的 stat 信息
   * @param {string} remotePath - 远程路径
   * @returns {Promise<{ size: number, lastmod: string, type: string }>}
   */
  async getStat(remotePath) {
    const stat = await this._client.stat(remotePath);
    return {
      size: stat.size,
      lastmod: stat.lastmod,
      type: stat.type,
    };
  }

  /**
   * 获取远程目录下的文件列表
   * @param {string} remoteDirPath - 远程目录路径
   * @returns {Promise<Array<{ filename: string, basename: string, lastmod: string, size: number, type: string }>>}
   */
  async listDirectory(remoteDirPath) {
    const contents = await this._client.getDirectoryContents(remoteDirPath);
    logger.debug(`列出远程目录: ${remoteDirPath}, 共 ${contents.length} 项`);
    return contents.map(item => ({
      filename: item.filename,
      basename: item.basename,
      lastmod: item.lastmod,
      size: item.size,
      type: item.type,
    }));
  }

  /**
   * 移动/重命名远程文件
   * @param {string} sourcePath - 源路径
   * @param {string} targetPath - 目标路径
   * @returns {Promise<void>}
   */
  async moveFile(sourcePath, targetPath) {
    await this._client.moveFile(sourcePath, targetPath);
    logger.debug(`移动远程文件: ${sourcePath} -> ${targetPath}`);
  }

  /**
   * 创建锁文件（用于同步互斥）
   * @param {string} lockPath - 锁文件路径
   * @param {string} lockId - 锁标识（通常为 deviceId + timestamp）
   * @returns {Promise<boolean>} - 是否成功获取锁
   */
  async acquireLock(lockPath, lockId) {
    try {
      const lockContent = JSON.stringify({
        lockId,
        acquiredAt: new Date().toISOString(),
        ttl: 10 * 60 * 1000, // 10分钟TTL
      });
      await this.putFileContent(lockPath, lockContent, false); // overwrite=false
      logger.info(`成功获取同步锁: ${lockPath}`);
      return true;
    } catch (err) {
      if (err.status === 412 || err.response?.status === 412) {
        // Precondition Failed — 文件已存在，锁被其他客户端持有
        logger.warn(`同步锁已被占用: ${lockPath}`);
        return false;
      }
      throw err;
    }
  }

  /**
   * 释放锁文件
   * @param {string} lockPath - 锁文件路径
   * @returns {Promise<void>}
   */
  async releaseLock(lockPath) {
    try {
      await this.deleteFile(lockPath);
      logger.info(`释放同步锁: ${lockPath}`);
    } catch (err) {
      // 锁文件可能已不存在，不视为错误
      if (err.status !== 404 && err.response?.status !== 404) {
        throw err;
      }
      logger.warn(`释放锁时文件已不存在: ${lockPath}`);
    }
  }

  /**
   * 断开连接（清理资源）
   */
  disconnect() {
    this._client = null;
    this._connected = false;
    logger.info('WebDAV 客户端已断开');
  }
}

module.exports = {
  WebDAVClient,
  createWebDAVClient,
};
