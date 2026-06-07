/**
 * User 模型 - 用户表操作
 *
 * 提供用户相关的完整 CRUD 操作：
 * - 注册/创建用户
 * - 按邮箱查询（登录验证）
 * - 更新用户信息
 * - 软删除/恢复
 * - 密码修改
 *
 * @module sqlite/User
 */

const { get, all, exec, transaction } = require('./connection')

class UserModel {
  /**
   * 创建新用户（注册）
   *
   * @param {{ email: string, password: string, name: string }} userData 用户数据
   * @returns {Object} 新创建的用户对象（不含密码）
   */
  create(userData) {
    const result = exec(
      `INSERT INTO users (email, password, name)
       VALUES (?, ?, ?);`,
      [userData.email, userData.password, userData.name]
    )

    return this.findById(result.lastInsertRowid)
  }

  /**
   * 根据 ID 查询用户
   * 自动排除已软删除的用户
   *
   * @param {number} id 用户ID
   * @returns {Object|null} 用户对象（不含密码）
   */
  findById(id) {
    const user = get(
      `SELECT id, email, name, avatar, created_at, updated_at
       FROM users
       WHERE id = ? AND deleted_at IS NULL;`,
      [id]
    )
    return user || null
  }

  /**
   * 根据邮箱查询用户（用于登录）
   * 包含密码字段用于验证，但不含敏感信息标记
   *
   * @param {string} email 邮箱地址
   * @returns {Object|null} 用户对象（含密码字段用于验证）
   */
  findByEmail(email) {
    return get(
      `SELECT id, email, password, name, avatar, created_at, updated_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL;`,
      [email]
    )
  }

  /**
   * 更新用户信息
   *
   * @param {number} id 用户ID
   * @param {{ name?: string, avatar?: string }} updateData 更新数据
   * @returns {Object|null} 更新后的用户对象
   */
  update(id, updateData) {
    const fields = []
    const values = []

    if (updateData.name !== undefined) {
      fields.push('name = ?')
      values.push(updateData.name)
    }
    if (updateData.avatar !== undefined) {
      fields.push('avatar = ?')
      values.push(updateData.avatar)
    }
    if (updateData.password !== undefined) {
      fields.push('password = ?')
      values.push(updateData.password)
    }

    if (fields.length === 0) return this.findById(id)

    fields.push('updated_at = datetime(\'now\')')
    values.push(id)

    exec(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL;`,
      values
    )

    return this.findById(id)
  }

  /**
   * 修改密码
   *
   * @param {number} id 用户ID
   * @param {string} newPassword 新密码（已加密）
   * @returns {boolean} 是否成功
   */
  updatePassword(id, newPassword) {
    const result = exec(
      `UPDATE users SET password = ?, updated_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL;`,
      [newPassword, id]
    )
    return result.changes > 0
  }

  /**
   * 软删除用户
   *
   * @param {number} id 用户ID
   * @returns {boolean} 是否成功
   */
  softDelete(id) {
    const result = exec(
      `UPDATE users SET deleted_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL;`,
      [id]
    )
    return result.changes > 0
  }

  /**
   * 恢复已软删除的用户
   *
   * @param {number} id 用户ID
   * @returns {boolean} 是否成功
   */
  restore(id) {
    const result = exec(
      `UPDATE users SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL;`,
      [id]
    )
    return result.changes > 0
  }

  /**
   * 分页获取所有未删除用户（管理用途）
   *
   * @param {number} [page=1] 页码
   * @param {number} [pageSize=20] 每页数量
   * @returns {{ items: Object[], pagination: Object }}
   */
  findAll(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize

    // 使用覆盖索引优化：只查必要字段
    const items = all(
      `SELECT id, email, name, avatar, created_at, updated_at
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?;`,
      [pageSize, offset]
    )

    const countResult = get(
      `SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL;`
    )

    const total = countResult?.total || 0

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

module.exports = new UserModel()
