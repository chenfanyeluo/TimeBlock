const { TimeBlock, Note } = require('../models')
const { success, error } = require('../utils/response')
const { Op, fn, col, literal } = require('sequelize')
const { durationInSeconds } = require('../utils/timeUtils')

/**
 * 按便签聚合
 */
function aggregateByNote(timeBlocks) {
  const noteMap = new Map()
  let totalDuration = 0

  for (const tb of timeBlocks) {
    const duration = durationInSeconds(tb.start_time, tb.end_time)
    totalDuration += duration

    const noteId = tb.note_id || 0
    const noteName = tb.note?.name || '其他'
    const color = tb.note?.color || '#909399'

    if (!noteMap.has(noteId)) {
      noteMap.set(noteId, {
        noteId: noteId,
        noteName: noteName,
        color,
        duration: 0
      })
    }

    noteMap.get(noteId).duration += duration
  }

  // 计算百分比
  const notes = Array.from(noteMap.values()).map(n => ({
    ...n,
    percentage: totalDuration > 0 ? Math.round((n.duration / totalDuration) * 10000) / 100 : 0
  }))

  return { totalDuration, notes }
}

/**
 * GET /api/statistics/daily
 * 日统计
 */
async function daily(req, res, next) {
  try {
    const { date } = req.query

    if (!date) {
      return error(res, 'VALIDATION_ERROR', '请指定日期参数 date', 400)
    }

    const dayStart = new Date(date + 'T00:00:00')
    const dayEnd = new Date(date + 'T23:59:59')

    const timeBlocks = await TimeBlock.findAll({
      where: {
        user_id: req.user.id,
        start_time: { [Op.gte]: dayStart },
        end_time: { [Op.lte]: dayEnd }
      },
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }],
      order: [['start_time', 'ASC']]
    })

    const { totalDuration, notes } = aggregateByNote(timeBlocks)

    return success(res, {
      date,
      totalDuration,
      notes
    })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/statistics/weekly
 * 周统计
 */
async function weekly(req, res, next) {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return error(res, 'VALIDATION_ERROR', '请指定 startDate 和 endDate', 400)
    }

    const start = new Date(startDate)
    const end = new Date(endDate + 'T23:59:59')

    const timeBlocks = await TimeBlock.findAll({
      where: {
        user_id: req.user.id,
        start_time: { [Op.gte]: start },
        end_time: { [Op.lte]: end }
      },
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }],
      order: [['start_time', 'ASC']]
    })

    // 按天分组
    const dayMap = new Map()
    for (const tb of timeBlocks) {
      const dayKey = new Date(tb.start_time).toISOString().split('T')[0]
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, 0)
      }
      dayMap.set(dayKey, dayMap.get(dayKey) + durationInSeconds(tb.start_time, tb.end_time))
    }

    const days = Array.from(dayMap.entries()).map(([date, totalDuration]) => ({
      date,
      totalDuration
    }))

    // 按便签汇总
    const { notes } = aggregateByNote(timeBlocks)

    return success(res, { days, notes })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/statistics/monthly
 * 月统计
 */
async function monthly(req, res, next) {
  try {
    const { year, month } = req.query

    if (!year || !month) {
      return error(res, 'VALIDATION_ERROR', '请指定 year 和 month', 400)
    }

    const y = parseInt(year)
    const m = parseInt(month)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 0, 23, 59, 59)

    const timeBlocks = await TimeBlock.findAll({
      where: {
        user_id: req.user.id,
        start_time: { [Op.gte]: monthStart },
        end_time: { [Op.lte]: monthEnd }
      },
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }]
    })

    // 按天分组
    const dayMap = new Map()
    for (const tb of timeBlocks) {
      const dayKey = new Date(tb.start_time).toISOString().split('T')[0]
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, 0)
      }
      dayMap.set(dayKey, dayMap.get(dayKey) + durationInSeconds(tb.start_time, tb.end_time))
    }

    // 生成月度热力图数据
    const totalDays = new Date(y, m, 0).getDate()
    const heatmap = []
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      heatmap.push({
        date: dateStr,
        duration: dayMap.get(dateStr) || 0
      })
    }

    const { totalDuration, notes } = aggregateByNote(timeBlocks)

    return success(res, {
      year: y,
      month: m,
      totalDuration,
      heatmap,
      notes
    })

  } catch (err) {
    next(err)
  }
}

module.exports = { daily, weekly, monthly }