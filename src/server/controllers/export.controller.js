const { TimeBlock, Note } = require('../models')
const sequelize = require('../config/database')
const { success, error } = require('../utils/response')

/**
 * 导入导出数据格式版本
 * 当前版本: 1.0
 * 用于前后端导入导出数据结构的兼容性校验
 */
const EXPORT_SCHEMA_VERSION = '1.0'

/**
 * 校验颜色格式 (#RRGGBB)
 */
function isValidColor(color) {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)
}

/**
 * 安全解析日期字符串
 * 返回 Date 对象或 null
 */
function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

/**
 * GET /api/export
 * 导出当前登录用户的便签和时间块数据为 JSON
 */
async function exportData(req, res, next) {
  try {
    // 查询当前用户的所有便签（包含软删除的，便于完整备份）
    const notes = await Note.findAll({
      where: { user_id: req.user.id },
      paranoid: false
    })

    // 查询当前用户的所有时间块（包含软删除的，便于完整备份）
    const timeBlocks = await TimeBlock.findAll({
      where: { user_id: req.user.id },
      paranoid: false,
      include: [
        {
          model: Note,
          as: 'note',
          attributes: ['id', 'name', 'color'],
          paranoid: false
        }
      ]
    })

    const exportPayload = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      app: 'TimeBlock',
      exportedAt: new Date().toISOString(),
      userId: req.user.id,
      notes: notes.map(n => ({
        name: n.name,
        color: n.color,
        autoRemind: n.auto_remind === true || n.auto_remind === 1,
        defaultAdvanceMinutes: n.default_advance_minutes
      })),
      timeBlocks: timeBlocks.map(tb => ({
        title: tb.title,
        description: tb.description,
        noteName: tb.note?.name || null,
        startTime: tb.start_time,
        endTime: tb.end_time,
        isCompleted: tb.is_completed === true || tb.is_completed === 1,
        createdAt: tb.created_at,
        updatedAt: tb.updated_at,
        deletedAt: tb.deleted_at
      }))
    }

    return success(res, exportPayload, '数据导出成功')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/import
 * 从 JSON 导入便签和时间块数据
 */
async function importData(req, res, next) {
  const payload = req.body

  // 1. 基础格式校验
  if (!payload || typeof payload !== 'object') {
    return error(res, 'VALIDATION_ERROR', '无效的导入数据格式', 400)
  }

  if (payload.app !== 'TimeBlock') {
    return error(res, 'VALIDATION_ERROR', '无效的 TimeBlock 数据文件', 400)
  }

  if (payload.schemaVersion && payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return error(
      res,
      'VALIDATION_ERROR',
      `不支持的导入数据版本: ${payload.schemaVersion}，当前支持: ${EXPORT_SCHEMA_VERSION}`,
      400
    )
  }

  const importedNotes = Array.isArray(payload.notes) ? payload.notes : []
  const importedBlocks = Array.isArray(payload.timeBlocks) ? payload.timeBlocks : []

  if (importedNotes.length === 0 && importedBlocks.length === 0) {
    return error(res, 'VALIDATION_ERROR', '文件中没有可导入的数据', 400)
  }

  // 2. 使用事务保证数据一致性
  const transaction = await sequelize.transaction()

  try {
    const userId = req.user.id
    const noteNameToId = new Map()
    let importedNotesCount = 0
    let importedBlocksCount = 0
    let skippedBlocksCount = 0
    const skippedReasons = []

    // 3. 导入便签：按名称匹配，不存在则新建；若存在但已软删除则恢复
    for (const noteItem of importedNotes) {
      const name = typeof noteItem.name === 'string' ? noteItem.name.trim() : ''
      if (!name) {
        continue
      }

      // 颜色校验，使用默认值兜底
      const color = isValidColor(noteItem.color) ? noteItem.color : '#409eff'

      // autoRemind 兼容布尔值和 1/0
      const autoRemind = noteItem.autoRemind === true || noteItem.autoRemind === 1 || noteItem.autoRemind === '1'
      const defaultAdvanceMinutes = Number.isFinite(noteItem.defaultAdvanceMinutes)
        ? Math.max(0, Math.min(60, noteItem.defaultAdvanceMinutes))
        : 5

      // 查询包含软删除的记录
      let note = await Note.findOne({
        where: { user_id: userId, name },
        paranoid: false,
        transaction
      })

      if (note) {
        // 已存在：更新字段，如果是软删除则恢复
        await note.update(
          {
            color,
            auto_remind: autoRemind,
            default_advance_minutes: defaultAdvanceMinutes
          },
          { transaction }
        )
        if (note.deleted_at) {
          await note.restore({ transaction })
        }
      } else {
        note = await Note.create(
          {
            user_id: userId,
            name,
            color,
            auto_remind: autoRemind,
            default_advance_minutes: defaultAdvanceMinutes
          },
          { transaction }
        )
      }

      noteNameToId.set(name, note.id)
      importedNotesCount++
    }

    // 4. 导入时间块
    for (const [index, block] of importedBlocks.entries()) {
      try {
        const title = typeof block.title === 'string' ? block.title.trim() : ''

        // 标题必填且不超过数据库限制 VARCHAR(200)
        if (!title) {
          throw new Error(`第 ${index + 1} 条时间块标题不能为空`)
        }
        if (title.length > 200) {
          throw new Error(`第 ${index + 1} 条时间块标题超过 200 字符限制`)
        }

        const startTime = parseDate(block.startTime)
        const endTime = parseDate(block.endTime)

        if (!startTime) {
          throw new Error(`第 ${index + 1} 条时间块开始时间格式不正确`)
        }
        if (!endTime) {
          throw new Error(`第 ${index + 1} 条时间块结束时间格式不正确`)
        }
        if (endTime <= startTime) {
          throw new Error(`第 ${index + 1} 条时间块结束时间必须晚于开始时间`)
        }

        const description =
          typeof block.description === 'string' && block.description.trim().length > 0
            ? block.description.trim()
            : null

        // 便签匹配
        let noteId = null
        const noteName = typeof block.noteName === 'string' ? block.noteName.trim() : null
        if (noteName) {
          noteId = noteNameToId.get(noteName) || null
        }

        // isCompleted 兼容布尔值和 1/0
        const isCompleted = block.isCompleted === true || block.isCompleted === 1 || block.isCompleted === '1'

        await TimeBlock.create(
          {
            user_id: userId,
            note_id: noteId,
            title,
            description,
            start_time: startTime,
            end_time: endTime,
            is_completed: isCompleted
          },
          { transaction }
        )

        importedBlocksCount++
      } catch (err) {
        skippedBlocksCount++
        skippedReasons.push(err.message)
      }
    }

    // 5. 提交事务
    await transaction.commit()

    return success(res, {
      importedNotes: importedNotesCount,
      importedBlocks: importedBlocksCount,
      skippedBlocks: skippedBlocksCount,
      totalNotes: importedNotes.length,
      totalBlocks: importedBlocks.length,
      skippedReasons: skippedReasons.slice(0, 10) // 最多返回前 10 条原因
    }, `成功导入 ${importedNotesCount} 个便签、${importedBlocksCount} 个时间块，跳过 ${skippedBlocksCount} 个时间块`)
  } catch (err) {
    // 事务回滚
    await transaction.rollback()
    next(err)
  }
}

module.exports = { exportData, importData }
