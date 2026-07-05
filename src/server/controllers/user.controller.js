const bcrypt = require('bcryptjs')
const { User } = require('../models')
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

module.exports = { updateProfile, changePassword }
