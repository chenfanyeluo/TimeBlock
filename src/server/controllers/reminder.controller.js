const { Reminder, TimeBlock, Note } = require('../models')
const { success, error } = require('../utils/response')
const { Op } = require('sequelize')

/**
 * GET /api/reminders
 * 获取当前用户的提醒列表
 */
async function list(req, res, next) {
  try {
    const { status, targetType, targetId, page = 1, pageSize = 50 } = req.query
    const where = { user_id: req.user.id }

    if (status) {
      where.status = status
    }
    if (targetType) {
      where.target_type = targetType
    }
    if (targetId) {
      where.target_id = parseInt(targetId)
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = parseInt(pageSize)

    const { count, rows } = await Reminder.findAndCountAll({
      where,
      order: [['remind_at', 'ASC']],
      offset,
      limit
    })

    const items = rows.map(r => ({
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
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))

    return res.status(200).json({
      success: true,
      data: {
        items,
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
 * GET /api/reminders/:id
 * 获取单个提醒
 */
async function getOne(req, res, next) {
  try {
    const { id } = req.params
    const reminder = await Reminder.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!reminder) {
      return error(res, 'NOT_FOUND', '提醒不存在', 404)
    }

    return success(res, {
      id: reminder.id,
      targetType: reminder.target_type,
      targetId: reminder.target_id,
      remindAt: reminder.remind_at,
      advanceMinutes: reminder.advance_minutes,
      isAuto: reminder.is_auto,
      noteId: reminder.note_id,
      title: reminder.title,
      message: reminder.message,
      status: reminder.status,
      triggeredAt: reminder.triggered_at,
      dismissedAt: reminder.dismissed_at,
      createdAt: reminder.created_at,
      updatedAt: reminder.updated_at
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/reminders
 * 创建提醒
 */
async function create(req, res, next) {
  try {
    const {
      targetType = 'time_block',
      targetId,
      remindAt,
      advanceMinutes = 0,
      isAuto = false,
      noteId,
      title,
      message
    } = req.body

    if (!targetId || !remindAt || !title) {
      return error(res, 'VALIDATION_ERROR', 'targetId、remindAt、title 为必填项', 400)
    }

    // 校验目标归属
    if (targetType === 'time_block') {
      const timeBlock = await TimeBlock.findOne({
        where: { id: targetId, user_id: req.user.id }
      })
      if (!timeBlock) {
        return error(res, 'NOT_FOUND', '关联时间块不存在', 404)
      }
    } else if (targetType === 'note') {
      const note = await Note.findOne({
        where: { id: targetId, user_id: req.user.id }
      })
      if (!note) {
        return error(res, 'NOT_FOUND', '关联便签不存在', 404)
      }
    } else {
      return error(res, 'VALIDATION_ERROR', 'targetType 只能是 time_block 或 note', 400)
    }

    // 若传了 noteId，校验便签归属
    if (noteId) {
      const note = await Note.findOne({
        where: { id: noteId, user_id: req.user.id }
      })
      if (!note) {
        return error(res, 'NOT_FOUND', '关联便签不存在', 404)
      }
    }

    const reminder = await Reminder.create({
      user_id: req.user.id,
      target_type: targetType,
      target_id: targetId,
      remind_at: new Date(remindAt),
      advance_minutes: parseInt(advanceMinutes) || 0,
      is_auto: !!isAuto,
      note_id: noteId || null,
      title,
      message: message || null,
      status: 'pending'
    })

    return success(res, {
      id: reminder.id,
      targetType: reminder.target_type,
      targetId: reminder.target_id,
      remindAt: reminder.remind_at,
      advanceMinutes: reminder.advance_minutes,
      isAuto: reminder.is_auto,
      noteId: reminder.note_id,
      title: reminder.title,
      message: reminder.message,
      status: reminder.status,
      createdAt: reminder.created_at,
      updatedAt: reminder.updated_at
    }, '提醒创建成功', 201)
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/reminders/:id
 * 更新提醒（仅允许更新部分字段）
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { remindAt, advanceMinutes, title, message, status } = req.body

    const reminder = await Reminder.findOne({
      where: { id, user_id: req.user.id }
    })
    if (!reminder) {
      return error(res, 'NOT_FOUND', '提醒不存在', 404)
    }

    // 只允许特定状态转换
    const allowedStatuses = ['pending', 'triggered', 'dismissed', 'cancelled']
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return error(res, 'VALIDATION_ERROR', '提醒状态无效', 400)
    }

    const updates = {}
    if (remindAt !== undefined) updates.remind_at = new Date(remindAt)
    if (advanceMinutes !== undefined) updates.advance_minutes = parseInt(advanceMinutes) || 0
    if (title !== undefined) updates.title = title
    if (message !== undefined) updates.message = message
    if (status !== undefined) updates.status = status

    // 状态变更时同步时间戳
    if (status === 'triggered') updates.triggered_at = new Date()
    if (status === 'dismissed') updates.dismissed_at = new Date()

    await reminder.update(updates)

    return success(res, {
      id: reminder.id,
      targetType: reminder.target_type,
      targetId: reminder.target_id,
      remindAt: reminder.remind_at,
      advanceMinutes: reminder.advance_minutes,
      isAuto: reminder.is_auto,
      noteId: reminder.note_id,
      title: reminder.title,
      message: reminder.message,
      status: reminder.status,
      triggeredAt: reminder.triggered_at,
      dismissedAt: reminder.dismissed_at,
      updatedAt: reminder.updated_at
    }, '提醒更新成功')
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/reminders/:id
 * 删除提醒
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params
    const reminder = await Reminder.findOne({
      where: { id, user_id: req.user.id }
    })
    if (!reminder) {
      return error(res, 'NOT_FOUND', '提醒不存在', 404)
    }

    await reminder.destroy()
    return success(res, null, '提醒已删除')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/reminders/:id/dismiss
 * 关闭提醒
 */
async function dismiss(req, res, next) {
  try {
    const { id } = req.params
    const reminder = await Reminder.findOne({
      where: { id, user_id: req.user.id }
    })
    if (!reminder) {
      return error(res, 'NOT_FOUND', '提醒不存在', 404)
    }

    await reminder.update({
      status: 'dismissed',
      dismissed_at: new Date()
    })

    return success(res, { id: reminder.id, status: reminder.status }, '提醒已关闭')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/reminders/:id/trigger
 * 触发提醒
 */
async function trigger(req, res, next) {
  try {
    const { id } = req.params
    const reminder = await Reminder.findOne({
      where: { id, user_id: req.user.id }
    })
    if (!reminder) {
      return error(res, 'NOT_FOUND', '提醒不存在', 404)
    }

    await reminder.update({
      status: 'triggered',
      triggered_at: new Date()
    })

    return success(res, { id: reminder.id, status: reminder.status }, '提醒已触发')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/reminders/:id/cancel
 * 取消提醒
 */
async function cancel(req, res, next) {
  try {
    const { id } = req.params
    const reminder = await Reminder.findOne({
      where: { id, user_id: req.user.id }
    })
    if (!reminder) {
      return error(res, 'NOT_FOUND', '提醒不存在', 404)
    }

    await reminder.update({ status: 'cancelled' })
    return success(res, { id: reminder.id, status: reminder.status }, '提醒已取消')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/reminders/due/pending
 * 获取待触发的提醒（remind_at <= now）
 */
async function due(req, res, next) {
  try {
    const reminders = await Reminder.findAll({
      where: {
        user_id: req.user.id,
        status: 'pending',
        remind_at: { [Op.lte]: new Date() }
      },
      order: [['remind_at', 'ASC']]
    })

    return success(res, reminders.map(r => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      remindAt: r.remind_at,
      advanceMinutes: r.advance_minutes,
      isAuto: r.is_auto,
      noteId: r.note_id,
      title: r.title,
      message: r.message
    })))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  dismiss,
  trigger,
  cancel,
  due
}
