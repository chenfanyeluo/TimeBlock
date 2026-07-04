const { TimeBlock, Note } = require('../models')
const { success, paginated, error } = require('../utils/response')
const { Op } = require('sequelize')

/**
 * GET /api/time-blocks
 * 获取时间块列表 (分页)
 */
async function list(req, res, next) {
  try {
    const {
      date, startDate, endDate, noteId,
      page = 1, pageSize = 20
    } = req.query

    const where = { user_id: req.user.id }

    // 支持 ?date=YYYY-MM-DD 简洁写法（兼容前端API）
    if (date) {
      const dayStart = new Date(date + 'T00:00:00.000Z')
      const dayEnd = new Date(date + 'T23:59:59.999Z')
      where.start_time = { [Op.gte]: dayStart }
      where.end_time = { [Op.lte]: dayEnd }
    } else if (startDate && endDate) {
      where.start_time = { [Op.gte]: new Date(startDate) }
      where.end_time = { [Op.lte]: new Date(endDate) }
    } else if (startDate) {
      where.start_time = { [Op.gte]: new Date(startDate) }
    } else if (endDate) {
      where.end_time = { [Op.lte]: new Date(endDate) }
    }

    if (noteId) {
      where.note_id = parseInt(noteId)
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = parseInt(pageSize)

    const { count, rows } = await TimeBlock.findAndCountAll({
      where,
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }],
      order: [['start_time', 'ASC']],
      offset,
      limit
    })

    const items = rows.map(tb => ({
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
      createdAt: tb.created_at,
      updatedAt: tb.updated_at
    }))

    return paginated(res, items, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total: count,
      totalPages: Math.ceil(count / parseInt(pageSize))
    })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/time-blocks/search
 * 搜索时间块
 */
async function search(req, res, next) {
  try {
    const { keyword, startDate, endDate, noteId } = req.query

    const where = { user_id: req.user.id }

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { '$note.name$': { [Op.like]: `%${keyword}%` } }
      ]
    }

    if (startDate && endDate) {
      where.start_time = { [Op.gte]: new Date(startDate) }
      where.end_time = { [Op.lte]: new Date(endDate) }
    }

    if (noteId) {
      where.note_id = parseInt(noteId)
    }

    const rows = await TimeBlock.findAll({
      where,
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }],
      order: [['start_time', 'DESC']],
      limit: 100
    })

    const items = rows.map(tb => ({
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
      createdAt: tb.created_at,
      updatedAt: tb.updated_at
    }))

    return success(res, items)

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/time-blocks
 * 创建时间块
 */
async function create(req, res, next) {
  try {
    const {
      title, description, noteId,
      startTime, endTime, isCompleted
    } = req.body

    // 验证便签归属
    if (noteId) {
      const note = await Note.findOne({
        where: { id: noteId, user_id: req.user.id }
      })
      if (!note) {
        return error(res, 'NOT_FOUND', '所属便签不存在', 404)
      }
    }

    const timeBlock = await TimeBlock.create({
      user_id: req.user.id,
      note_id: noteId || null,
      title,
      description: description || null,
      start_time: new Date(startTime),
      end_time: new Date(endTime),
      is_completed: isCompleted || false
    })

    // 关联查询便签信息
    const result = await TimeBlock.findByPk(timeBlock.id, {
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }]
    })

    return success(res, {
      id: result.id,
      title: result.title,
      description: result.description,
      noteId: result.note_id,
      note: result.note ? {
        id: result.note.id,
        name: result.note.name,
        color: result.note.color
      } : null,
      startTime: result.start_time,
      endTime: result.end_time,
      isCompleted: result.is_completed,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }, '时间块创建成功', 201)

  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/time-blocks/:id
 * 更新时间块
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const {
      title, description, noteId,
      startTime, endTime, isCompleted
    } = req.body

    const timeBlock = await TimeBlock.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!timeBlock) {
      return error(res, 'NOT_FOUND', '时间块不存在', 404)
    }

    // 验证便签归属
    if (noteId) {
      const note = await Note.findOne({
        where: { id: noteId, user_id: req.user.id }
      })
      if (!note) {
        return error(res, 'NOT_FOUND', '所属便签不存在', 404)
      }
    }

    const updates = {}
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (noteId !== undefined) updates.note_id = noteId
    if (startTime !== undefined) updates.start_time = new Date(startTime)
    if (endTime !== undefined) updates.end_time = new Date(endTime)
    if (isCompleted !== undefined) updates.is_completed = isCompleted

    await timeBlock.update(updates)

    const result = await TimeBlock.findByPk(timeBlock.id, {
      include: [{
        model: Note,
        as: 'note',
        attributes: ['id', 'name', 'color']
      }]
    })

    return success(res, {
      id: result.id,
      title: result.title,
      description: result.description,
      noteId: result.note_id,
      note: result.note ? {
        id: result.note.id,
        name: result.note.name,
        color: result.note.color
      } : null,
      startTime: result.start_time,
      endTime: result.end_time,
      isCompleted: result.is_completed,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }, '时间块更新成功')

  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/time-blocks/:id
 * 删除时间块
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params

    const timeBlock = await TimeBlock.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!timeBlock) {
      return error(res, 'NOT_FOUND', '时间块不存在', 404)
    }

    await timeBlock.destroy()

    return success(res, null, '时间块已删除')

  } catch (err) {
    next(err)
  }
}

module.exports = { list, search, create, update, remove }