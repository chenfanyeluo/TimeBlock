const { TimeBlock, Category } = require('../models')
const { success, error } = require('../utils/response')

/**
 * GET /api/export
 * 导出数据
 */
async function exportData(req, res, next) {
  try {
    const { format = 'json' } = req.query

    // 查询用户所有数据
    const [categories, timeBlocks] = await Promise.all([
      Category.findAll({ where: { user_id: req.user.id } }),
      TimeBlock.findAll({
        where: { user_id: req.user.id },
        include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'color'] }]
      })
    ])

    const exportPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userId: req.user.id,
      categories: categories.map(c => ({
        name: c.name,
        color: c.color,
        icon: c.icon,
        sortOrder: c.sort_order
      })),
      timeBlocks: timeBlocks.map(tb => ({
        title: tb.title,
        description: tb.description,
        categoryName: tb.category?.name || null,
        startTime: tb.start_time,
        endTime: tb.end_time,
        isCompleted: tb.is_completed
      }))
    }

    if (format === 'excel') {
      // TODO: 实际集成 excel 导出库 (如 exceljs)
      return error(res, 'NOT_IMPLEMENTED', 'Excel 导出功能开发中', 501)
    }

    // JSON 格式直接返回
    return success(res, exportPayload, '数据导出成功')

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/import
 * 导入数据 (JSON 格式)
 */
async function importData(req, res, next) {
  try {
    const importPayload = req.body

    if (!importPayload || !importPayload.timeBlocks) {
      return error(res, 'VALIDATION_ERROR', '无效的导入数据格式', 400)
    }

    let imported = 0
    let skipped = 0

    for (const block of importPayload.timeBlocks) {
      try {
        // 查找或创建匹配的分类
        let categoryId = null
        if (block.categoryName) {
          const [category] = await Category.findOrCreate({
            where: {
              user_id: req.user.id,
              name: block.categoryName
            },
            defaults: {
              user_id: req.user.id,
              name: block.categoryName,
              color: '#1890ff'
            }
          })
          categoryId = category.id
        }

        await TimeBlock.create({
          user_id: req.user.id,
          category_id: categoryId,
          title: block.title || '未命名',
          description: block.description || null,
          start_time: new Date(block.startTime),
          end_time: new Date(block.endTime),
          is_completed: block.isCompleted || false
        })

        imported++
      } catch {
        skipped++
      }
    }

    return success(res, {
      imported,
      skipped,
      total: importPayload.timeBlocks.length
    }, `成功导入 ${imported} 条，跳过 ${skipped} 条`)

  } catch (err) {
    next(err)
  }
}

module.exports = { exportData, importData }
