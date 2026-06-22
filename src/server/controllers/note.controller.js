const { Note, TimeBlock } = require('../models')
const { success, error } = require('../utils/response')

/**
 * GET /api/notes
 * 获取便签列表
 */
async function list(req, res, next) {
  try {
    const notes = await Note.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'ASC']]
    })

    return success(res, notes.map(n => ({
      id: n.id,
      name: n.name,
      color: n.color,
      createdAt: n.created_at
    })))

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/notes
 * 创建便签
 */
async function create(req, res, next) {
  try {
    const { name, color } = req.body

    const note = await Note.create({
      user_id: req.user.id,
      name,
      color: color || '#409eff'
    })

    return success(res, {
      id: note.id,
      name: note.name,
      color: note.color,
      createdAt: note.created_at
    }, '便签创建成功', 201)

  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/notes/:id
 * 更新便签
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { name, color } = req.body

    const note = await Note.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!note) {
      return error(res, 'NOT_FOUND', '便签不存在', 404)
    }

    const updates = {}
    if (name !== undefined) updates.name = name
    if (color !== undefined) updates.color = color

    await note.update(updates)

    return success(res, {
      id: note.id,
      name: note.name,
      color: note.color,
      createdAt: note.created_at
    }, '便签更新成功')

  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/notes/:id
 * 删除便签
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params

    const note = await Note.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!note) {
      return error(res, 'NOT_FOUND', '便签不存在', 404)
    }

    // 将关联时间块的 note_id 置空
    await TimeBlock.update(
      { note_id: null },
      { where: { note_id: id, user_id: req.user.id } }
    )

    await note.destroy()

    return success(res, null, '便签已删除')

  } catch (err) {
    next(err)
  }
}

module.exports = { list, create, update, remove }