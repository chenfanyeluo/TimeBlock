const bcrypt = require('bcryptjs')
const { User, Note, TimeBlock, Reminder, SyncLog, Statistic } = require('../models')
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
 * 账号注销 — 密码二次确认后软删除用户及清理关联数据
 */
async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body
    const user = req.user

    if (!password) {
      return error(res, 'VALIDATION_ERROR', '请输入密码以确认注销', 400)
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return error(res, 'VALIDATION_ERROR', '密码错误，无法注销账号', 400)
    }

    const now = new Date()

    // 清除敏感信息并脱敏
    await user.update({
      email: `deleted_${user.id}_${Date.now()}@deleted.timeblock`,
      name: '已注销用户',
      avatar: null,
      reset_token: null,
      reset_token_expires: null
    })

    // 软删除用户（paranoid 模式自动设置 deleted_at）
    await user.destroy()

    // 软删除便签和时间块（paranoid 模式: destroy() 自动设置 deleted_at）
    await Promise.all([
      Note.destroy({ where: { user_id: user.id } }),
      TimeBlock.destroy({ where: { user_id: user.id } })
    ])

    // 硬删除提醒、同步日志、统计数据（无 paranoid，属于可丢弃数据）
    await Promise.all([
      Reminder.destroy({ where: { user_id: user.id } }),
      SyncLog.destroy({ where: { user_id: user.id } }),
      Statistic.destroy({ where: { user_id: user.id } })
    ])

    console.log(`[注销] 用户 ${user.id} 已注销，关联数据已清理`)

    return success(res, {
      deletedAt: now.toISOString()
    }, '账号已成功注销')

  } catch (err) {
    next(err)
  }
}

module.exports = { updateProfile, changePassword, deleteAccount }
