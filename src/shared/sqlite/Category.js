/**
 * Category 模型 - 分类表操作
 *
 * 提供分类的完整 CRUD 操作：
 * - 创建分类
 * - 编辑分类
 * - 删除分类（级联删除 / 转移时间块）
 * - 分类列表（支持排序）
 * - 软删除恢复
 *
 * 业务规则:
 * - 每个用户的分类 name 在未删除记录中唯一
 * - 删除分类时需选择: cascade(级联删除关联时间块) 或 transfer(转移到其他分类)
 *
 * @module sqlite/Category
 */

const { get, all, exec, execInTx, transaction } = require('./connection')

class CategoryModel {
  /**
   * 创建分类
   *
   * @param {{ user_id: number, name: string, color?: string, icon?: string, sort_order?: number }} data
   * @returns {Object} 新创建的分类
   */
  create(data) {
    const result = exec(
      `INSERT INTO categories (user_id, name, color, icon, sort_order)
       VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM categories WHERE user_id = ?), 0) + 1);`,
      [
        data.user_id,
        data.name,
        data.color || '#1890ff',
        data.icon || null,
        data.user_id
      ]
    )

    return this.findById(result.lastInsertRowid)
  }

  /**
   * 根据 ID 查询分类
   *
   * @param {number} id 分类ID
   * @returns {Object|null}
   */
  findById(id) {
    return get(
      `SELECT id, user_id, name, color, icon, sort_order, created_at, updated_at
       FROM categories
       WHERE id = ? AND deleted_at IS NULL;`,
      [id]
    )
  }

  /**
   * 获取用户的所有分类（按 sort_order 排序）
   *
   * @param {number} userId 用户ID
   * @returns {Object[]}
   */
  findByUserId(userId) {
    return all(
      `SELECT id, user_id, name, color, icon, sort_order, created_at, updated_at
       FROM categories
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC;`,
      [userId]
    )
  }

  /**
   * 更新分类信息
   *
   * @param {number} id 分类ID
   * @param {{ name?: string, color?: string, icon?: string, sort_order?: number }} data
   * @returns {Object|null}
   */
  update(id, data) {
    const fields = []
    const values = []

    if (data.name !== undefined) {
      fields.push('name = ?')
      values.push(data.name)
    }
    if (data.color !== undefined) {
      fields.push('color = ?')
      values.push(data.color)
    }
    if (data.icon !== undefined) {
      fields.push('icon = ?')
      values.push(data.icon)
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?')
      values.push(data.sort_order)
    }

    if (fields.length === 0) return this.findById(id)

    fields.push('updated_at = datetime(\'now\')')
    values.push(id)

    exec(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL;`,
      values
    )

    return this.findById(id)
  }

  /**
   * 删除分类
   *
   * @param {number} id 分类ID
   * @param {'cascade'|'transfer'} action 操作类型
   * @param {number} [transferToId] 转移目标分类ID（action=transfer 时必填）
   * @returns {{ success: boolean, message: string }}
   */
  delete(id, action = 'cascade', transferToId = null) {
    const category = this.findById(id)
    if (!category) {
      return { success: false, message: '分类不存在' }
    }

    return transaction((database) => {
      if (action === 'cascade') {
        // 级联删除：软删除该分类下所有关联的时间块
        execInTx(database,
          `UPDATE time_blocks SET deleted_at = datetime('now')
           WHERE category_id = ? AND deleted_at IS NULL;`,
          [id]
        )
      } else if (action === 'transfer') {
        // 转移：将关联时间块转移到目标分类
        if (!transferToId) {
          throw new Error('转移操作需要指定目标分类ID')
        }
        const targetCategory = this.findById(transferToId)
        if (!targetCategory) {
          throw new Error('目标分类不存在')
        }
        execInTx(database,
          `UPDATE time_blocks SET category_id = ? WHERE category_id = ? AND deleted_at IS NULL;`,
          [transferToId, id]
        )
      }

      // 软删除分类本身
      execInTx(database,
        `UPDATE categories SET deleted_at = datetime('now') WHERE id = ?;`,
        [id]
      )

      return {
        success: true,
        message: action === 'cascade'
          ? '分类及其关联时间块已删除'
          : `分类已删除，关联时间块已转移到指定分类`
      }
    })
  }

  /**
   * 软删除分类（简单版本，不处理关联数据）
   *
   * @param {number} id 分类ID
   * @returns {boolean}
   */
  softDelete(id) {
    const result = exec(
      `UPDATE categories SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL;`,
      [id]
    )
    return result.changes > 0
  }

  /**
   * 恢复已删除的分类
   *
   * @param {number} id 分类ID
   * @returns {boolean}
   */
  restore(id) {
    const result = exec(
      `UPDATE categories SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL;`,
      [id]
    )
    return result.changes > 0
  }

  /**
   * 批量更新排序顺序
   *
   * @param {Array<{ id: number, sort_order: number }>} orders 排序数组
   */
  batchUpdateSortOrder(orders) {
    transaction((database) => {
      for (const item of orders) {
        execInTx(database,
          `UPDATE categories SET sort_order = ?, updated_at = datetime('now')
           WHERE id = ? AND deleted_at IS NULL;`,
          [item.sort_order, item.id]
        )
      }
    })
  }

  /**
   * 检查分类是否属于指定用户
   *
   * @param {number} categoryId 分类ID
   * @param {number} userId 用户ID
   * @returns {boolean}
   */
  belongsToUser(categoryId, userId) {
    const row = get(
      `SELECT id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
      [categoryId, userId]
    )
    return !!row
  }
}

module.exports = new CategoryModel()
