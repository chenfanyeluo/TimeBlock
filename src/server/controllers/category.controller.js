const { Category, TimeBlock } = require('../models')
const { success, error } = require('../utils/response')
const { Op } = require('sequelize')

/**
 * GET /api/categories
 * 获取分类列表
 */
async function list(req, res, next) {
  try {
    const categories = await Category.findAll({
      where: { user_id: req.user.id },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    })

    return success(res, categories.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      sortOrder: c.sort_order,
      createdAt: c.created_at
    })))

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/categories
 * 创建分类
 */
async function create(req, res, next) {
  try {
    const { name, color, icon } = req.body

    // 获取当前最大排序号
    const maxSort = await Category.max('sort_order', {
      where: { user_id: req.user.id }
    })

    const category = await Category.create({
      user_id: req.user.id,
      name,
      color: color || '#1890ff',
      icon: icon || null,
      sort_order: (maxSort || 0) + 1
    })

    return success(res, {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      sortOrder: category.sort_order,
      createdAt: category.created_at
    }, '分类创建成功', 201)

  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/categories/:id
 * 更新分类
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { name, color, icon, sortOrder } = req.body

    const category = await Category.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!category) {
      return error(res, 'NOT_FOUND', '分类不存在', 404)
    }

    const updates = {}
    if (name !== undefined) updates.name = name
    if (color !== undefined) updates.color = color
    if (icon !== undefined) updates.icon = icon
    if (sortOrder !== undefined) updates.sort_order = sortOrder

    await category.update(updates)

    return success(res, {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      sortOrder: category.sort_order,
      createdAt: category.created_at
    }, '分类更新成功')

  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/categories/:id
 * 删除分类
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params
    const { action, transferTo } = req.query

    const category = await Category.findOne({
      where: { id, user_id: req.user.id }
    })

    if (!category) {
      return error(res, 'NOT_FOUND', '分类不存在', 404)
    }

    if (action === 'transfer' && transferTo) {
      // 转移时间块到目标分类
      await TimeBlock.update(
        { category_id: transferTo },
        { where: { category_id: id, user_id: req.user.id } }
      )
    } else {
      // 级联置空
      await TimeBlock.update(
        { category_id: null },
        { where: { category_id: id, user_id: req.user.id } }
      )
    }

    await category.destroy()

    return success(res, null, '分类已删除')

  } catch (err) {
    next(err)
  }
}

module.exports = { list, create, update, remove }
