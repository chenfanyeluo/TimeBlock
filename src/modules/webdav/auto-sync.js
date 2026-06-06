/**
 * 自动同步调度器模块
 * 基于 setInterval 实现定时自动同步功能
 * 支持动态调整间隔、启停控制、网络感知等
 *
 * 使用方式：
 *   autoSync.start({ dataProvider, dataWriter })  // 启动
 *   autoSync.stop()                                // 停止
 *   autoSync.updateInterval(60)                    // 更新间隔为60分钟
 */

'use strict';

const configManager = require('./config');
const { syncEngine } = require('./sync-engine');
const { Defaults, SyncStatus } = require('./types');
const logger = require('./utils/logger');

class AutoSyncScheduler {
  constructor() {
    /** @type {NodeJS.Timer|null} 定时器句柄 */
    this._timer = null;
    /** @type {boolean} 是否正在运行 */
    this._running = false;
    /** @type {number} 当前同步间隔（毫秒） */
    this._intervalMs = Defaults.SYNC_INTERVAL_MIN * 60 * 1000;
    /** @type {Function|null} 外部注入的数据提供者 */
    this._dataProvider = null;
    /** @type {Function|null} 外部注入的数据写入者 */
    this._dataWriter = null;
    /** @type {number} 上次同步时间戳 */
    this._lastSyncTime = 0;
    /** @type {boolean} 是否因错误暂停（避免频繁重试） */
    this._pausedDueToError = false;
  }

  /**
   * 调度器是否正在运行
   * @returns {boolean}
   */
  get isRunning() {
    return this._running;
  }

  /**
   * 获取当前配置的同步间隔（毫秒）
   * @returns {number}
   */
  get interval() {
    return this._intervalMs;
  }

  /**
   * 启动自动同步
   * @param {Object} options
   * @param {Function} options.dataProvider - 数据提供者函数 () => Promise<{ categories, timeBlocks }>
   * @param {Function} [options.dataWriter] - 数据写入函数 (data) => Promise<void>
   * @param {number} [options.intervalMin] - 自定义同步间隔（分钟），不传则从配置文件读取
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    if (this._running) {
      logger.warn('自动同步已在运行中');
      return;
    }

    // 检查是否已配置 WebDAV
    const configured = await configManager.isConfigured();
    if (!configured) {
      logger.info('WebDAV 未配置，跳过启动自动同步');
      return;
    }

    // 保存数据提供者和写入者
    this._dataProvider = options.dataProvider || null;
    this._dataWriter = options.dataWriter || null;

    if (!this._dataProvider) {
      throw new Error('启动自动同步必须提供 dataProvider 参数');
    }

    // 确定同步间隔
    let intervalMin = options.intervalMin;
    if (intervalMin === undefined || intervalMin === null) {
      const config = await configManager.getConfig();
      intervalMin = config?.syncInterval ?? Defaults.SYNC_INTERVAL_MIN;
    }

    // 边界约束
    intervalMin = Math.max(
      Defaults.SYNC_INTERVAL_MIN_LIMIT,
      Math.min(Defaults.SYNC_INTERVAL_MAX_LIMIT, intervalMin)
    );

    this._intervalMs = intervalMin * 60 * 1000;
    this._running = true;
    this._pausedDueToError = false;

    // 设置定时器
    this._scheduleNext();

    logger.info(`自动同步已启动 | 间隔=${intervalMin}分钟 (${this._intervalMs}ms)`);
  }

  /**
   * 停止自动同步
   * @returns {void}
   */
  stop() {
    if (!this._running) {
      return;
    }

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    this._running = false;
    logger.info('自动同步已停止');
  }

  /**
   * 动态更新同步间隔（无需重启）
   * @param {number} newIntervalMin - 新的间隔（分钟）
   * @returns {void}
   */
  updateInterval(newIntervalMin) {
    if (typeof newIntervalMin !== 'number' || newIntervalMin <= 0) {
      logger.warn(`无效的同步间隔值: ${newIntervalMin}`);
      return;
    }

    const clamped = Math.max(
      Defaults.SYNC_INTERVAL_MIN_LIMIT,
      Math.min(Defaults.SYNC_INTERVAL_MAX_LIMIT, newIntervalMin)
    );

    this._intervalMs = clamped * 60 * 1000;
    logger.info(`同步间隔已更新为 ${clamped} 分钟`);

    // 如果正在运行，重新调度
    if (this._running) {
      this._reschedule();
    }
  }

  /**
   * 立即触发一次同步（不等待定时器）
   * @returns {Promise<Object>} - 同步结果
   */
  async triggerNow() {
    if (!this._dataProvider) {
      throw new Error('无法触发同步：未设置 dataProvider');
    }

    logger.info('手动触发立即同步...');
    return this._executeSync();
  }

  /**
   * 安排下一次定时执行
   * @private
   */
  _scheduleNext() {
    if (this._timer) {
      clearInterval(this._timer);
    }

    this._timer = setInterval(() => {
      this._onTick().catch(err => {
        logger.error(`自动同步定时任务异常: ${err.message}`, err.stack);
      });
    }, this._intervalMs);
  }

  /**
   * 重新安排定时器（用于间隔变更后）
   * @private
   */
  _reschedule() {
    this._scheduleNext();
    logger.info(`自动同步已重新调度 | 间隔=${Math.round(this._intervalMs / 60000)}分钟`);
  }

  /**
   * 定时器回调
   * @private
   * @returns {Promise<void>}
   */
  async _onTick() {
    if (!this._running) return;

    // 防抖：如果同步引擎正忙，跳过本次
    if (syncEngine.isSyncing) {
      logger.debug('跳过自动同步：上一次同步尚未完成');
      return;
    }

    // 因错误暂停后，延长等待时间再尝试（退避策略）
    if (this._pausedDueToError) {
      logger.debug('自动同步处于错误暂停状态，跳过本次');
      this._pausedDueToError = false; // 下次恢复正常
      return;
    }

    await this._executeSync();
  }

  /**
   * 执行一次同步操作
   * @private
   * @returns {Promise<Object>}
   */
  async _executeSync() {
    try {
      const result = await syncEngine.sync({
        dataProvider: this._dataProvider,
        dataWriter: this._dataWriter,
        direction: 'bidirectional',
        conflictStrategy: 'merge',
      });

      this._lastSyncTime = Date.now();

      if (!result.success) {
        this._pausedDueToError = true;
        logger.warn(`自动同步失败，将在下一周期重试: ${result.error}`);
      }

      return result;
    } catch (err) {
      this._pausedDueToError = true;
      logger.error(`自动同步执行异常: ${err.message}`, err.stack);
      throw err;
    }
  }
}

// 导出单例实例
const autoSync = new AutoSyncScheduler();

module.exports = {
  AutoSyncScheduler,
  autoSync,
};
