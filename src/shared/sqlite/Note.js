/**
 * Note 模型 - 便签表操作
 *
 * 提供便签的完整 CRUD 操作：
 * - 创建便签
 * - 编辑便签（名称、颜色）
 * - 删除便签（级联置空关联时间块的 note_id）
 * - 便签列表
 *
 * 业务规则:
 * - 每个用户的便签 name 在未删除记录中唯一
 * - 删除便签时，关联时间块的 note_id 置空（不级联删除时间块）
 *
 * @module sqlite/Note
 */

const { get, all, exec } = require('./connection')

class NoteModel {
  /**
   * 创建便签
   *
   * @param {{ user_id: number, name: string, color?: string }} data
   * @returns {Object} 新创建的便签
   */
  create(data) {
    const result = exec(
      `INSERT INTO notes (user_id, name, color, auto_remind, default_advance_minutes)
       VALUES (?, ?, ?, ?, ?);`,
      [
        data.user_id,
        data.name,
        data.color || '#409eff',
        data.auto_remind !== undefined ? (data.auto_remind ? 1 : 0) : 0,
        data.default_advance_minutes !== undefined ? data.default_advance_minutes : 5
      ]
    )

    return this.findById(result.lastInsertRowid)
  }

  /**
   * 根据 ID 查询便签
   *
   * @param {number} id 便签ID
   * @returns {Object|null}
   */
  findById(id) {
    return get(
      `SELECT id, user_id, name, color, auto_remind, default_advance_minutes, created_at, updated_at
       FROM notes
       WHERE id = ? AND deleted_at IS NULL;`,
      [id]
    )
  }

  /**
   * 获取用户的所有便签（按创建时间排序）
   *
   * @param {number} userId 用户ID
   * @returns {Object[]}
   */
  findByUserId(userId) {
    return all(
      `SELECT id, user_id, name, color, auto_remind, default_advance_minutes, created_at, updated_at
       FROM notes
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC;`,
      [userId]
    )
  }

  /**
   * 更新便签信息
   *
   * @param {number} id 便签ID
   * @param {{ name?: string, color?: string }} data
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
    if (data.auto_remind !== undefined) {
      fields.push('auto_remind = ?')
      values.push(data.auto_remind ? 1 : 0)
    }
    if (data.default_advance_minutes !== undefined) {
      fields.push('default_advance_minutes = ?')
      values.push(data.default_advance_minutes)
    }

    if (fields.length === 0) return this.findById(id)

    fields.push("updated_at = datetime('now')")
    values.push(id)

    exec(
      `UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL;`,
      values
    )

    return this.findById(id)
  }

  /**
   * 删除便签
   *
   * 将关联时间块的 note_id 置空，然后软删除便签本身
   *
   * @param {number} id 便签ID
   * @returns {{ success: boolean, message: string }}
   */
  delete(id) {
    const note = this.findById(id)
    if (!note) {
      return { success: false, message: '便签不存在' }
    }

    // 将关联时间块的 note_id 置空
    exec(
      `UPDATE time_blocks SET note_id = NULL
       WHERE note_id = ? AND deleted_at IS NULL;`,
      [id]
    )

    // 软删除便签本身
    exec(
      `UPDATE notes SET deleted_at = datetime('now') WHERE id = ?;`,
      [id]
    )

    return { success: true, message: '便签已删除，关联时间块已解除绑定' }
  }

  /**
   * 检查便签是否属于指定用户
   *
   * @param {number} noteId 便签ID
   * @param {number} userId 用户ID
   * @returns {boolean}
   */
  belongsToUser(noteId, userId) {
    const row = get(
      `SELECT id FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
      [noteId, userId]
    )
    return !!row
  }
}

module.exports = new NoteModel()
