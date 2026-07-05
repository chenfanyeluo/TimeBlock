const { SyncLog, Statistic, TimeBlock, Note, Reminder } = require('../models')
const { success, error } = require('../utils/response')
const { Op } = require('sequelize')
const { durationInSeconds } = require('../utils/timeUtils')

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
      // 上传便签变更
      if (changes.notes && changes.notes.length > 0) {
        for (const noteData of changes.notes) {
          await Note.upsert({
            id: noteData.id,
            user_id: userId,
            name: noteData.name,
            color: noteData.color,
            auto_remind: noteData.autoRemind !== undefined ? !!noteData.autoRemind : false,
            default_advance_minutes: noteData.defaultAdvanceMinutes !== undefined
              ? parseInt(noteData.defaultAdvanceMinutes) || 5
              : 5
          })
          synced++
        }
      }

      // 上传时间块变更
      if (changes.timeBlocks && changes.timeBlocks.length > 0) {
        for (const tb of changes.timeBlocks) {
          await TimeBlock.upsert({
            id: tb.id,
            user_id: userId,
            note_id: tb.noteId,
            title: tb.title,
            description: tb.description,
            start_time: tb.startTime,
            end_time: tb.endTime,
            is_completed: tb.isCompleted
          })
          synced++
        }
      }

      // 上传提醒变更
      if (changes.reminders && changes.reminders.length > 0) {
        for (const r of changes.reminders) {
          await Reminder.upsert({
            id: r.id,
            user_id: userId,
            target_type: r.targetType || 'time_block',
            target_id: r.targetId,
            remind_at: r.remindAt,
            advance_minutes: r.advanceMinutes !== undefined ? parseInt(r.advanceMinutes) || 0 : 0,
            is_auto: r.isAuto !== undefined ? !!r.isAuto : false,
            note_id: r.noteId || null,
            title: r.title,
            message: r.message || null,
            status: r.status || 'pending',
            triggered_at: r.triggeredAt || null,
            dismissed_at: r.dismissedAt || null
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
    const [notes, timeBlocks, reminders] = await Promise.all([
      Note.findAll({
        where: whereClause
      }),
      TimeBlock.findAll({
        where: whereClause,
        include: [{ model: Note, as: 'note', attributes: ['id', 'name', 'color'] }]
      }),
      Reminder.findAll({
        where: whereClause
      })
    ])

    const data = {
      serverTime: new Date().toISOString(),
      notes: notes.map(n => ({
        id: n.id,
        name: n.name,
        color: n.color,
        autoRemind: n.auto_remind,
        defaultAdvanceMinutes: n.default_advance_minutes,
        updatedAt: n.updated_at
      })),
      timeBlocks: timeBlocks.map(tb => ({
        id: tb.id,
        title: tb.title,
        description: tb.description,
        noteId: tb.note_id,
        note: tb.note ? {
          id: tb.note.id,
          name: tb.note.name,
          color: tb.note.color
        } : null,
        startTime: tb.start_time,
        endTime: tb.end_time,
        isCompleted: tb.is_completed,
        updatedAt: tb.updated_at
      })),
      reminders: reminders.map(r => ({
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        remindAt: r.remind_at,
        advanceMinutes: r.advance_minutes,
        isAuto: r.is_auto,
        noteId: r.note_id,
        title: r.title,
        message: r.message,
        status: r.status,
        triggeredAt: r.triggered_at,
        dismissedAt: r.dismissed_at,
        updatedAt: r.updated_at
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

    // 按便签汇总
    const noteStats = new Map()
    let totalSeconds = 0
    let totalBlocks = 0

    for (const tb of timeBlocks) {
      const duration = durationInSeconds(tb.start_time, tb.end_time)
      const noteId = tb.note_id || 0
      totalSeconds += duration
      totalBlocks++

      if (!noteStats.has(noteId)) {
        noteStats.set(noteId, { seconds: 0, count: 0 })
      }
      const stat = noteStats.get(noteId)
      stat.seconds += duration
      stat.count++
    }

    // 写入/更新统计表
    await Statistic.upsert({
      user_id: userId,
      stat_date: targetDate,
      note_id: null,
      total_seconds: totalSeconds,
      block_count: totalBlocks
    })

    for (const [noteId, stat] of noteStats) {
      await Statistic.upsert({
        user_id: userId,
        stat_date: targetDate,
        note_id: noteId === 0 ? null : noteId,
        total_seconds: stat.seconds,
        block_count: stat.count
      })
    }

    return success(res, {
      date: targetDate,
      totalNotes: noteStats.size,
      totalSeconds
    }, '统计数据已刷新')

  } catch (err) {
    next(err)
  }
}

module.exports = { upload, download, status, logs, refreshStatistics }