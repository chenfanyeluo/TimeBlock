/**
 * 冲突检测与解决模块
 * 基于最后更新时间和数据哈希检测同步冲突
 * 提供多种冲突解决策略：保留本地/保留云端/合并（保留较新）/跳过
 */

'use strict';

const { hashData } = require('./encrypt');
const { ConflictStrategy, Defaults } = require('./types');
const logger = require('./utils/logger');

/**
 * 检测单条数据的变更状态
 * 对比本地和远程的数据，判断是否存在冲突
 *
 * @param {Object} localItem - 本地数据项
 * @param {string|number} localItem.id - 本地ID
 * @param {string} localItem.updatedAt - 本地更新时间 (ISO)
 * @param {Object} remoteItem - 远程数据项
 * @param {string|number} remoteItem.id - 远程ID
 * @param {string} remoteItem.updatedAt - 远程更新时间 (ISO)
 * @returns {{ status: 'local_newer'|'remote_newer'|'identical'|'conflict'|'local_only'|'remote_only', localItem: Object, remoteItem: Object }}
 */
function detectConflict(localItem, remoteItem) {
  // 仅本地有
  if (!remoteItem) {
    return { status: 'local_only', localItem, remoteItem: null };
  }
  // 仅远程有
  if (!localItem) {
    return { status: 'remote_only', localItem: null, remoteItem };
  }

  const localTime = new Date(localItem.updatedAt).getTime();
  const remoteTime = new Date(remoteItem.updatedAt).getTime();

  // 计算内容哈希
  const localHash = hashData(localItem);
  const remoteHash = hashData(remoteItem);

  // 内容完全一致（无冲突）
  if (localHash === remoteHash) {
    return { status: 'identical', localItem, remoteItem };
  }

  // 内容不同，比较时间戳判断方向
  const timeDiff = Math.abs(localTime - remoteTime);
  // 如果时间差在 5 秒以内，视为同时修改 → 冲突
  if (timeDiff <= 5000) {
    return { status: 'conflict', localItem, remoteItem };
  }

  if (localTime > remoteTime) {
    return { status: 'local_newer', localItem, remoteItem };
  } else {
    return { status: 'remote_newer', localItem, remoteItem };
  }
}

/**
 * 批量检测数据集的冲突
 * @param {Array<Object>} localItems - 本地数据数组
 * @param {Array<Object>} remoteItems - 远程数据数组
 * @param {string} [idField='id'] - 用于匹配记录的 ID 字段名
 * @returns {{
 *   toUpload: Array<{ localItem: Object, remoteItem?: Object }>,
 *   toDownload: Array<{ remoteItem: Object, localItem?: Object }>,
 *   identical: Array<Object>,
 *   conflicts: Array<{ localItem: Object, remoteItem: Object }>
 * }}
 */
function detectBatchConflicts(localItems, remoteItems, idField = 'id') {
  const localMap = new Map();
  const remoteMap = new Map();

  for (const item of localItems) {
    localMap.set(String(item[idField]), item);
  }
  for (const item of remoteItems) {
    remoteMap.set(String(item[idField]), item);
  }

  const result = {
    toUpload: [],      // 需要上传到云端的本地新数据
    toDownload: [],    // 需要从云端下载的远程新数据
    identical: [],     // 完全一致的记录
    conflicts: [],     // 存在冲突的记录
  };

  // 收集所有 ID 的并集
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const localItem = localMap.get(id) || null;
    const remoteItem = remoteMap.get(id) || null;
    const detection = detectConflict(localItem, remoteItem);

    switch (detection.status) {
      case 'local_only':
      case 'local_newer':
        result.toUpload.push(detection);
        break;
      case 'remote_only':
      case 'remote_newer':
        result.toDownload.push(detection);
        break;
      case 'identical':
        result.identical.push(detection.localItem);
        break;
      case 'conflict':
        result.conflicts.push(detection);
        break;
    }
  }

  logger.info(
    `冲突检测结果: 上传=${result.toUpload.length}, 下载=${result.toDownload.length}, ` +
    `一致=${result.identical.length}, 冲突=${result.conflicts.length}`
  );

  return result;
}

/**
 * 解决单个冲突
 * 根据指定策略返回最终应采用的数据
 *
 * @param {Object} conflict - detectConflict 返回的冲突对象
 * @param {string} strategy - ConflictStrategy 枚举值
 * @returns {{ resolvedItem: Object, strategyUsed: string }} - 解决结果
 */
function resolveConflict(conflict, strategy) {
  if (conflict.status !== 'conflict') {
    // 非冲突项直接返回对应数据
    switch (conflict.status) {
      case 'local_only':
      case 'local_newer':
        return { resolvedItem: conflict.localItem, strategyUsed: ConflictStrategy.KEEP_LOCAL };
      case 'remote_only':
      case 'remote_newer':
        return { resolvedItem: conflict.remoteItem, strategyUsed: ConflictStrategy.KEEP_REMOTE };
      case 'identical':
        return { resolvedItem: conflict.localItem, strategyUsed: 'identical' };
      default:
        throw new Error(`未知的冲突状态: ${conflict.status}`);
    }
  }

  logger.debug(`解决冲突 [策略=${strategy}]`, {
    localId: conflict.localItem?.id,
    remoteId: conflict.remoteItem?.id,
  });

  let resolvedItem;
  let strategyUsed = strategy;

  switch (strategy) {
    case ConflictStrategy.KEEP_LOCAL:
      resolvedItem = conflict.localItem;
      break;

    case ConflictStrategy.KEEP_REMOTE:
      resolvedItem = conflict.remoteItem;
      break;

    case ConflictStrategy.MERGE:
      // 合并策略：保留较新的版本（基于 updatedAt）
      const localTime = new Date(conflict.localItem.updatedAt).getTime();
      const remoteTime = new Date(conflict.remoteItem.updatedAt).getTime();
      resolvedItem = localTime >= remoteTime ? conflict.localItem : conflict.remoteItem;
      strategyUsed = localTime >= remoteTime ? ConflictStrategy.KEEP_LOCAL : ConflictStrategy.KEEP_REMOTE;
      logger.debug(`合并策略：选择${localTime >= remoteTime ? '本地' : '远程'}（较新版本）`);
      break;

    case ConflictStrategy.SKIP:
      // 跳过：返回本地版本但不标记为已处理（调用方需自行决定）
      resolvedItem = conflict.localItem; // 默认保留本地不变
      break;

    default:
      throw new Error(`不支持的冲突解决策略: ${strategy}`);
  }

  return { resolvedItem, strategyUsed };
}

/**
 * 批量解决冲突
 * @param {Array<Object>} conflicts - 冲突列表
 * @param {string} strategy - 统一使用的解决策略
 * @returns {Array<{ resolvedItem: Object, strategyUsed: string, originalConflict: Object }>}
 */
function resolveConflicts(conflicts, strategy) {
  return conflicts.map(conflict => {
    const resolution = resolveConflict(conflict, strategy);
    return {
      ...resolution,
      originalConflict: conflict,
    };
  });
}

module.exports = {
  detectConflict,
  detectBatchConflicts,
  resolveConflict,
  resolveConflicts,
};
