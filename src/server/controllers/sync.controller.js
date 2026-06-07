const { SyncLog, Statistic } = require('../models')
const { TimeBlock, Category } = require('../models')
const { success, error } = require('../utils/response')
const { Op } = require('sequelize')

/**
 * POST /api/sync/upload
 * 客户端上传本地变更到云端
 * 由成员E的同步引擎调用
 */
async function upload(req, res, next) {
  try {
    const { changes, lastSyncAt, deviceId } = req.body
    const userId = req.user.id
    let synced = 0

    const syncLog = await SyncLog.create({
      user_id: userId,
      sync_type: changes.syncType || 'manual',
      status: 'in_progress',
      records_synced: 0
    })

    try {
      // 上传分类变更
      if (changes.categories && changes.categories.length > 0) {
        for (const cat of changes.categories) {
          const [category] = await Category.upsert({
            id: cat.id,
            user_id: userId,
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            sort_order: cat.sortOrder
          })
          synced++
        }
      }

      // 上传时间块变更
      if (changes.timeBlocks && changes.timeBlocks.length > 0) {
        for (const tb of changes.timeBlocks) {
          const [timeBlock] = await TimeBlock.upsert({
            id: tb.id,
            user_id: userId,
            category_id: tb.categoryId,
            title: tb.title,
            description: tb.description,
            start_time: tb.startTime,
            end_time: tb.endTime,
            is_completed: tb.isCompleted
          })
          synced++
        }
      }

      // 标记完成
      await syncLog.update({
        status: 'completed',
        records_synced: synced,
        completed_at: new Date()
      })

      return success(res, {
        synced,
        syncId: syncLog.id,
        serverTime: new Date().toISOString()
      }, '数据同步上传成功')

    } catch (syncErr) {
      await syncLog.update({
        status: 'failed',
        error_message: syncErr.message,
        completed_at: new Date()
      })
      throw syncErr
    }

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/sync/download
 * 客户端下载云端变更
 * 由成员E的同步引擎调用
 */
async function download(req, res, next) {
  try {
    const { lastSyncAt } = req.query
    const userId = req.user.id

    const whereClause = { user_id: userId }
    if (lastSyncAt) {
      whereClause.updated_at = { [Op.gt]: new Date(lastSyncAt) }
    }

    // 获取自上次同步以来的变更
    const [categories, timeBlocks] = await Promise.all([
      Category.findAll({
        where: lastSyncAt ? { user_id: userId } : { user_id: userId }
      }),
      TimeBlock.findAll({
        where: whereClause,
        include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'color'] }]
      })
    ])

    const data = {
      serverTime: new Date().toISOString(),
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        sortOrder: c.sort_order
      })),
      timeBlocks: timeBlocks.map(tb => ({
        id: tb.id,
        title: tb.title,
        description: tb.description,
        categoryId: tb.category_id,
        category: tb.category ? {
          id: tb.category.id,
          name: tb.category.name,
          color: tb.category.color
        } : null,
        startTime: tb.start_time,
        endTime: tb.end_time,
        isCompleted: tb.is_completed,
        updatedAt: tb.updated_at
      }))
    }

    return success(res, data)

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/sync/status
 * 获取同步状态
 */
async function status(req, res, next) {
  try {
    const userId = req.user.id

    // 最近一次同步
    const lastSync = await SyncLog.findOne({
      where: { user_id: userId, status: 'completed' },
      order: [['completed_at', 'DESC']]
    })

    // 同步统计
    const syncCount = await SyncLog.count({ where: { user_id: userId } })
    const failCount = await SyncLog.count({ where: { user_id: userId, status: 'failed' } })

    return success(res, {
      lastSyncAt: lastSync?.completed_at || null,
      lastSyncId: lastSync?.id || null,
      totalSyncs: syncCount,
      failedSyncs: failCount,
      isOnline: true
    })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/sync/logs
 * 获取同步记录列表
 */
async function logs(req, res, next) {
  try {
    const { page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = parseInt(pageSize)

    const { count, rows } = await SyncLog.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['started_at', 'DESC']],
      offset,
      limit
    })

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map(r => ({
          id: r.id,
          syncType: r.sync_type,
          status: r.status,
          recordsSynced: r.records_synced,
          startedAt: r.started_at,
          completedAt: r.completed_at,
          errorMessage: r.error_message
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count,
          totalPages: Math.ceil(count / parseInt(pageSize))
        }
      }
    })

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/sync/statistics/refresh
 * 刷新统计汇总数据 (预计算)
 */
async function refreshStatistics(req, res, next) {
  try {
    const userId = req.user.id
    const { date } = req.body

    const targetDate = date || new Date().toISOString().split('T')[0]
    const dayStart = new Date(targetDate + 'T00:00:00')
    const dayEnd = new Date(targetDate + 'T23:59:59')

    const timeBlocks = await TimeBlock.findAll({
      where: {
        user_id: userId,
        start_time: { [Op.gte]: dayStart },
        end_time: { [Op.lte]: dayEnd }
      }
    })

    // 按分类汇总
    const categoryStats = new Map()
    let totalSeconds = 0
    let totalBlocks = 0

    for (const tb of timeBlocks) {
      const duration = Math.floor((new Date(tb.end_time) - new Date(tb.start_time)) / 1000)
      const catId = tb.category_id || 0
      totalSeconds += duration
      totalBlocks++

      if (!categoryStats.has(catId)) {
        categoryStats.set(catId, { seconds: 0, count: 0 })
      }
      const stat = categoryStats.get(catId)
      stat.seconds += duration
      stat.count++
    }

    // 写入/更新统计表
    await Statistic.upsert({
      user_id: userId,
      stat_date: targetDate,
      category_id: null,
      total_seconds: totalSeconds,
      block_count: totalBlocks
    })

    for (const [catId, stat] of categoryStats) {
      await Statistic.upsert({
        user_id: userId,
        stat_date: targetDate,
        category_id: catId === 0 ? null : catId,
        total_seconds: stat.seconds,
        block_count: stat.count
      })
    }

    return success(res, {
      date: targetDate,
      totalCategories: categoryStats.size,
      totalSeconds
    }, '统计数据已刷新')

  } catch (err) {
    next(err)
  }
}

module.exports = { upload, download, status, logs, refreshStatistics }
