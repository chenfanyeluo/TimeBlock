/**
 * 同步引擎核心模块
 * 协调 WebDAV 客户端、配置管理、冲突解决器完成完整的同步流程
 *
 * 同步流程：
 * 1. 检查配置和连接
 * 2. 获取分布式锁（防止多端并发）
 * 3. 获取云端元数据和本地数据
 * 4. 对比差异、检测冲突
 * 5. 执行上传/下载
 * 6. 处理冲突
 * 7. 更新同步元数据和时间
 * 8. 释放锁
 */

'use strict';

const { v4: uuidv4 } = require('crypto');
const { WebDAVClient } = require('./client');
const configManager = require('./config');
const { detectBatchConflicts, resolveConflicts } = require('./conflict-resolver');
const syncHistoryManager = require('./sync-history');
const { hashData } = require('./encrypt');
const {
  SyncStatus,
  SyncDirection,
  DataFiles,
  Defaults,
  WebDAVErrorCodes,
} = require('./types');
const logger = require('./utils/logger');

/**
 * 同步引擎类
 * 封装完整的双向同步逻辑
 */
class SyncEngine {
  constructor() {
    /** @type {WebDAVClient|null} */
    this._client = null;
    /** @type {boolean} 是否正在同步中 */
    this._syncing = false;
    /** @type {string|null} 当前同步 ID */
    this._currentSyncId = null;
  }

  /**
   * 获取当前是否正在同步
   * @returns {boolean}
   */
  get isSyncing() {
    return this._syncing;
  }

  /**
   * 获取当前同步 ID
   * @returns {string|null}
   */
  get currentSyncId() {
    return this._currentSyncId;
  }

  /**
   * 初始化 WebDAV 客户端
   * @private
   * @returns {Promise<WebDAVClient>}
   */
  async _initClient() {
    const config = await configManager.getConfigWithPassword();
    if (!config) {
      throw Object.assign(new Error('WebDAV 未配置，请先设置同步账号'), {
        code: WebDAVErrorCodes.CONFIG_NOT_FOUND,
      });
    }
    this._client = new WebDAVClient(config);
    return this._client;
  }

  /**
   * 从数据提供者获取待同步的本地数据
   * 由外部注入，解耦具体数据源
   * @private
   * @param {Function} dataProvider - 异步函数，返回 { categories: [], timeBlocks: [] }
   * @returns {Promise<{ categories: Array, timeBlocks: Array }>}
   */
  async _getLocalData(dataProvider) {
    if (typeof dataProvider !== 'function') {
      throw new Error('dataProvider 必须是一个函数');
    }
    return await dataProvider();
  }

  /**
   * 解析云端 JSON 数据文件
   * @private
   * @param {string} rawContent - 文件原始内容字符串
   * @param {string} fileName - 文件名（用于日志）
   * @returns {Promise<Array>} - 解析后的数据数组
   */
  async _parseRemoteData(rawContent, fileName) {
    try {
      const data = JSON.parse(rawContent);
      if (!Array.isArray(data)) {
        logger.warn(`云端 ${fileName} 数据格式异常：期望数组`);
        return [];
      }
      return data;
    } catch (err) {
      logger.error(`解析云端 ${fileName} 数据失败: ${err.message}`);
      return [];
    }
  }

  /**
   * 将数据写入本地存储
   * 由外部注入，解耦具体存储实现
   * @private
   * @param {Function} dataWriter - 异步函数，接收 { categories, timeBlocks, conflicts }
   * @param {Object} data - 待写入的数据
   * @returns {Promise<void>}
   */
  async _writeLocalData(dataWriter, data) {
    if (typeof dataWriter !== 'function') {
      throw new Error('dataWriter 必须是一个函数');
    }
    await dataWriter(data);
  }

  /**
   * 执行完整同步流程
   *
   * @param {Object} options - 同步选项
   * @param {Function} options.dataProvider - 数据提供者函数 () => Promise<{ categories, timeBlocks }>
   * @param {Function} options.dataWriter - 数据写入函数 (data) => Promise<void>
   * @param {string} [options.direction='bidirectional'] - 同步方向
   * @param {string} [options.conflictStrategy='merge'] - 冲突解决策略
   * @returns {Promise<Object>} - 同步结果
   */
  async sync(options) {
    // ---- 并发保护 ----
    if (this._syncing) {
      throw Object.assign(new Error('已有同步任务正在进行中，请稍后再试'), {
        code: WebDAVErrorCodes.SYNC_IN_PROGRESS,
      });
    }

    const {
      dataProvider,
      dataWriter,
      direction = SyncDirection.BIDIRECTIONAL,
      conflictStrategy = ConflictStrategy.MERGE,
    } = options;

    if (!dataProvider || typeof dataProvider !== 'function') {
      throw new Error('sync() 必须提供 dataProvider 参数');
    }

    this._syncing = true;
    this._currentSyncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 创建同步历史记录
    const historyRecord = await syncHistoryManager.createRecord({
      syncId: this._currentSyncId,
      status: SyncStatus.IN_PROGRESS,
    });

    logger.info(`========== 开始同步 [${this._currentSyncId}] 方向=${direction} ==========`);

    try {
      // ===== 步骤1: 初始化客户端并测试连接 =====
      const client = await this._initClient();
      const connResult = await client.testConnection();
      if (!connResult.success) {
        throw Object.assign(new Error(connResult.message), {
          code: WebDAVErrorCodes.CONNECTION_FAILED,
        });
      }

      // ===== 步骤2: 确保远程同步目录存在 =====
      const config = await configManager.getConfigWithPassword();
      const syncDir = config.syncDirectory;
      await client.ensureDirectory(syncDir);
      logger.info(`远程同步目录就绪: ${syncDir}`);

      // ===== 步骤3: 获取分布式锁 =====
      const lockPath = `${syncDir}/${DataFiles.LOCK_FILE}`;
      const lockAcquired = await client.acquireLock(lockPath, this._currentSyncId);
      if (!lockAcquired) {
        throw Object.assign(new Error('无法获取同步锁，可能其他设备正在同步'), {
          code: WebDAVErrorCodes.LOCK_ACQUISITION_FAILED,
        });
      }

      try {
        // ===== 步骤4: 获取云端元数据 =====
        const metaPath = `${syncDir}/${DataFiles.SYNC_META}`;
        let remoteMeta = null;
        if (await client.exists(metaPath)) {
          const metaContent = await client.getFileContent(metaPath);
          remoteMeta = JSON.parse(metaContent);
          logger.debug(`云端元数据: lastSyncAt=${remoteMeta?.lastSyncAt}, version=${remoteMeta?.version}`);
        }

        // ===== 步骤5: 获取本地数据 =====
        const localData = await this._getLocalData(dataProvider);
        logger.debug(`本地数据: categories=${localData.categories?.length || 0}, timeBlocks=${localData.timeBlocks?.length || 0}`);

        // ===== 步骤6: 获取云端数据 =====
        let remoteCategories = [];
        let remoteTimeBlocks = [];

        const categoriesPath = `${syncDir}/${DataFiles.CATEGORIES}`;
        const timeBlocksPath = `${syncDir}/${DataFiles.TIME_BLOCKS}`;

        if (await client.exists(categoriesPath)) {
          const rawCategories = await client.getFileContent(categoriesPath);
          remoteCategories = await this._parseRemoteData(rawCategories, DataFiles.CATEGORIES);
        }
        if (await client.exists(timeBlocksPath)) {
          const rawTimeBlocks = await client.getFileContent(timeBlocksPath);
          remoteTimeBlocks = await this._parseRemoteData(rawTimeBlocks, DataFiles.TIME_BLOCKS);
        }

        logger.debug(`云端数据: categories=${remoteCategories.length}, timeBlocks=${remoteTimeBlocks.length}`);

        // ===== 步骤7: 冲突检测 =====
        const categoryConflicts = detectBatchConflicts(
          localData.categories || [],
          remoteCategories
        );
        const timeBlockConflicts = detectBatchConflicts(
          localData.timeBlocks || [],
          remoteTimeBlocks
        );

        const totalConflicts = categoryConflicts.conflicts.length + timeBlockConflicts.conflicts.length;

        // ===== 步骤8: 统计上传/下载数量 =====
        let uploadCount = 0;
        let downloadCount = 0;
        const resolvedConflicts = [];

        // --- 处理分类 ---
        if (direction === SyncDirection.UPLOAD || direction === SyncDirection.BIDIRECTIONAL) {
          // 上传本地新增/更新的分类
          for (const item of categoryConflicts.toUpload) {
            uploadCount++;
          }
        }
        if (direction === SyncDirection.DOWNLOAD || direction === SyncDirection.BIDIRECTIONAL) {
          // 下载远程新增/更新的分类
          for (const item of categoryConflicts.toDownload) {
            downloadCount++;
          }
        }
        // 解决分类冲突
        if (categoryConflicts.conflicts.length > 0) {
          const resolved = resolveConflicts(categoryConflicts.conflicts, conflictStrategy);
          resolvedConflicts.push(...resolved.map(r => ({ ...r, type: 'category' })));
        }

        // --- 处理时间块 ---
        if (direction === SyncDirection.UPLOAD || direction === SyncDirection.BIDIRECTIONAL) {
          for (const item of timeBlockConflicts.toUpload) {
            uploadCount++;
          }
        }
        if (direction === SyncDirection.DOWNLOAD || direction === SyncDirection.BIDIRECTIONAL) {
          for (const item of timeBlockConflicts.toDownload) {
            downloadCount++;
          }
        }
        // 解决时间块冲突
        if (timeBlockConflicts.conflicts.length > 0) {
          const resolved = resolveConflicts(timeBlockConflicts.conflicts, conflictStrategy);
          resolvedConflicts.push(...resolved.map(r => ({ ...r, type: 'timeBlock' })));
        }

        // ===== 步骤9: 组装最终数据并上传/下载 =====

        // 计算最终要上传到云端的数据集合
        const finalCategories = this._mergeSyncResults(
          localData.categories || [],
          remoteCategories,
          categoryConflicts,
          resolvedConflicts.filter(r => r.type === 'category'),
          direction
        );

        const finalTimeBlocks = this._mergeSyncResults(
          localData.timeBlocks || [],
          remoteTimeBlocks,
          timeBlockConflicts,
          resolvedConflicts.filter(r => r.type === 'timeBlock'),
          direction
        );

        // 上传整合后的数据到云端
        const exportData = {
          version: Defaults.DATA_FILE_VERSION,
          exportedAt: new Date().toISOString(),
          syncId: this._currentSyncId,
          categories: finalCategories,
          timeBlocks: finalTimeBlocks,
        };

        await client.putFileContent(categoriesPath, JSON.stringify(finalCategories, null, 2));
        await client.putFileContent(timeBlocksPath, JSON.stringify(finalTimeBlocks, null, 2));

        // 更新云端元数据
        const newMeta = {
          version: Defaults.DATA_FILE_VERSION,
          lastSyncAt: new Date().toISOString(),
          syncId: this._currentSyncId,
          categoriesHash: hashData(finalCategories),
          timeBlocksHash: hashData(finalTimeBlocks),
        };
        await client.putFileContent(metaPath, JSON.stringify(newMeta, null, 2));

        // 写入本地数据（如果需要下载或解决了冲突）
        if (downloadCount > 0 || totalConflicts > 0) {
          if (dataWriter && typeof dataWriter === 'function') {
            await this._writeLocalData(dataWriter, {
              categories: finalCategories,
              timeBlocks: finalTimeBlocks,
              conflicts: resolvedConflicts,
            });
          }
        }

        // ===== 步骤10: 更新最后同步时间 =====
        await configManager.updateLastSyncTime(new Date().toISOString());

        // ===== 步骤11: 更新同步历史 =====
        await syncHistoryManager.updateRecord(this._currentSyncId, {
          status: SyncStatus.COMPLETED,
          completedAt: new Date().toISOString(),
          uploaded: uploadCount,
          downloaded: downloadCount,
          conflicts: totalConflicts,
        });

        logger.info(
          `========== 同步完成 [${this._currentSyncId}] ` +
          `上传=${uploadCount} 下载=${downloadCount} 冲突=${totalConflicts} ==========`
        );

        return {
          success: true,
          syncId: this._currentSyncId,
          status: SyncStatus.COMPLETED,
          uploaded: uploadCount,
          downloaded: downloadCount,
          conflicts: totalConflicts,
          conflictDetails: resolvedConflicts,
        };

      } finally {
        // 确保释放锁
        await client.releaseLock(lockPath).catch(err => {
          logger.warn(`释放锁失败: ${err.message}`);
        });
      }

    } catch (err) {
      logger.error(`同步失败 [${this._currentSyncId}]: ${err.message}`, err.stack);

      // 更新同步历史为失败状态
      await syncHistoryManager.updateRecord(this._currentSyncId, {
        status: SyncStatus.FAILED,
        errorMessage: err.message,
      }).catch(() => {});

      return {
        success: false,
        syncId: this._currentSyncId,
        status: SyncStatus.FAILED,
        error: err.message,
        errorCode: err.code,
      };

    } finally {
      this._syncing = false;
      this._currentSyncId = null;
      if (this._client) {
        this._client.disconnect();
        this._client = null;
      }
    }
  }

  /**
   * 根据同步方向和冲突解决结果，合并本地和云端数据
   * @private
   * @param {Array} localData - 本地数据
   * @param {Array} remoteData - 云端数据
   * @param {Object} conflicts - 冲突检测结果
   * @param {Array} resolvedConflicts - 已解决的冲突列表
   * @param {string} direction - 同步方向
   * @returns {Array} - 最终合并后的数据
   */
  _mergeSyncResults(localData, remoteData, conflicts, resolvedConflicts, direction) {
    const resultMap = new Map();

    // 以远程数据为基础
    for (const item of remoteData) {
      resultMap.set(String(item.id), { ...item });
    }

    // 用本地较新的数据覆盖
    for (const item of conflicts.toUpload) {
      resultMap.set(String(item.localItem.id), { ...item.localItem });
    }

    // 用远程较新的数据覆盖（下载方向）
    if (direction === SyncDirection.DOWNLOAD || direction === SyncDirection.BIDIRECTIONAL) {
      for (const item of conflicts.toDownload) {
        resultMap.set(String(item.remoteItem.id), { ...item.remoteItem });
      }
    }

    // 应用冲突解决结果
    for (const rc of resolvedConflicts) {
      if (rc.resolvedItem) {
        resultMap.set(String(rc.resolvedItem.id), { ...rc.resolvedItem });
      }
    }

    // 对于仅本地的数据，确保也包含在结果中（上传时）
    if (direction === SyncDirection.UPLOAD || direction === SyncDirection.BIDIRECTIONAL) {
      for (const item of conflicts.toUpload) {
        if (!resultMap.has(String(item.localItem.id))) {
          resultMap.set(String(item.localItem.id), { ...item.localItem });
        }
      }
    }

    return Array.from(resultMap.values());
  }

  /**
   * 取消当前正在进行的同步
   * @returns {Promise<void>}
   */
  async cancel() {
    if (!this._syncing) {
      logger.warn('没有正在进行的同步任务');
      return;
    }

    logger.info(`请求取消同步 [${this._currentSyncId}]`);

    if (this._currentSyncId) {
      await syncHistoryManager.updateRecord(this._currentSyncId, {
        status: SyncStatus.CANCELLED,
      }).catch(() => {});
    }

    // 标记取消（当前同步循环会在下次检查时退出）
    this._syncing = false;
    this._currentSyncId = null;
  }
}

// 导出单例实例
const syncEngine = new SyncEngine();

module.exports = {
  SyncEngine,
  syncEngine,
};
