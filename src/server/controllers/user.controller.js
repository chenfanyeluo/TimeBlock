const bcrypt = require('bcryptjs')
const { User, Note, TimeBlock, SyncLog, Statistic } = require('../models')
const { success, error } = require('../utils/response')

/**
 * PUT /api/users/profile
 * 更新用户信息
 */
async function updateProfile(req, res, next) {
  try {
    const { name, avatar } = req.body
    const user = req.user

    const updates = {}
    if (name !== undefined) updates.name = name
    if (avatar !== undefined) updates.avatar = avatar

    if (Object.keys(updates).length === 0) {
      return error(res, 'VALIDATION_ERROR', '没有需要更新的字段', 400)
    }

    await user.update(updates)

    return success(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.created_at
    }, '个人信息更新成功')

  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/users/password
 * 修改密码
 */
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body
    const user = req.user

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password)
    if (!isOldPasswordValid) {
      return error(res, 'VALIDATION_ERROR', '旧密码错误', 400)
    }

    // 新密码加密
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await user.update({ password: hashedPassword })

    return success(res, null, '密码修改成功，请重新登录')

  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/users/account
 * 账号注销 — 二次确认后软删除用户及所有关联数据
 *
 * 流程：
 * 1. 验证密码（二次确认）
 * 2. 软删除用户（设置 deleted_at）
 * 3. 软删除所有关联数据：便签、时间块、同步日志、统计数据
 * 4. 清除敏感信息（email脱敏、reset_token清除）
 */
async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body
    const user = req.user

    // 二次确认：验证密码
    if (!password) {
      return error(res, 'VALIDATION_ERROR', '请输入密码以确认注销', 400)
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return error(res, 'VALIDATION_ERROR', '密码错误，无法注销账号', 400)
    }

    const now = new Date()

    // 软删除用户（清除敏感信息）
    user.deleted_at = now
    user.reset_token = null
    user.reset_token_expires_at = null
    // 将邮箱脱敏后保留，防止唯一索引冲突的同时标记已注销
    user.email = `deleted_${user.id}_${Date.now()}@deleted.timeblock`
    user.name = '已注销用户'
    user.avatar = null
    await user.save()

    // 软删除所有关联数据
    await Promise.all([
      Note.update(
        { deleted_at: now },
        { where: { user_id: user.id, deleted_at: null } }
      ),
      TimeBlock.update(
        { deleted_at: now },
        { where: { user_id: user.id, deleted_at: null } }
      ),
      SyncLog.destroy({ where: { user_id: user.id } }),
      Statistic.destroy({ where: { user_id: user.id } })
    ])

    console.log(`[注销] 用户 ${user.id} 已注销，关联数据已清理`)

    return success(res, {
      deletedAt: now.toISOString()
    }, '账号已成功注销。感谢使用 TimeBlock，期待再次相遇。')

  } catch (err) {
    next(err)
  }
}

module.exports = { updateProfile, changePassword, deleteAccount }
