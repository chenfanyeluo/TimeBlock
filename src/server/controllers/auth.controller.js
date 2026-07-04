const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User } = require('../models')
const { success, error } = require('../utils/response')

const JWT_SECRET = process.env.JWT_SECRET || 'timeblock-jwt-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/** 密码重置令牌有效期（毫秒），默认 1 小时 */
const RESET_TOKEN_TTL = 60 * 60 * 1000

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

/**
 * 过滤返回给客户端的用户字段
 */
function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    createdAt: user.created_at
  }
}

/**
 * POST /api/auth/register
 * 用户注册
 */
async function register(req, res, next) {
  try {
    const { email, password, name } = req.body

    // 检查邮箱是否已注册
    const existingUser = await User.findOne({ where: { email } })
    if (existingUser) {
      return error(res, 'CONFLICT', '该邮箱已被注册', 409)
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await User.create({
      email,
      password: hashedPassword,
      name
    })

    // 生成 Token
    const accessToken = generateToken(user)

    return success(res, {
      accessToken,
      user: sanitizeUser(user)
    }, '注册成功', 201)

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/login
 * 用户登录
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body

    // 查找用户
    const user = await User.findOne({ where: { email } })
    if (!user) {
      return error(res, 'UNAUTHORIZED', '邮箱或密码错误', 401)
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return error(res, 'UNAUTHORIZED', '邮箱或密码错误', 401)
    }

    // 生成 Token
    const accessToken = generateToken(user)

    return success(res, {
      accessToken,
      user: sanitizeUser(user)
    }, '登录成功')

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/refresh
 * 刷新 Token
 */
async function refresh(req, res, next) {
  try {
    const user = req.user

    // 生成新 Token
    const accessToken = generateToken(user)

    return success(res, {
      accessToken
    }, '令牌刷新成功')

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
async function me(req, res, next) {
  try {
    return success(res, sanitizeUser(req.user))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/forgot-password
 * 忘记密码 — 发送密码重置令牌
 *
 * 流程：
 * 1. 根据邮箱查找用户
 * 2. 生成随机重置令牌（crypto.randomBytes）
 * 3. 将令牌哈希后存入数据库，设置 1 小时过期
 * 4. 开发环境：在响应中返回原始令牌供测试
 *    生产环境：通过邮件发送重置链接（需配置邮件服务）
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body

    // 出于安全考虑，无论用户是否存在都返回相同消息
    const user = await User.findOne({ where: { email } })
    if (!user) {
      return success(res, null, '如果该邮箱已注册，重置链接已发送')
    }

    // 生成随机令牌
    const rawToken = crypto.randomBytes(32).toString('hex')

    // 哈希后存储（与密码同理，防止数据库泄露后令牌被利用）
    const hashedToken = await bcrypt.hash(rawToken, 10)

    user.reset_token = hashedToken
    user.reset_token_expires_at = new Date(Date.now() + RESET_TOKEN_TTL)
    await user.save()

    // 开发环境下返回原始令牌方便测试
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] 密码重置令牌 (${email}): ${rawToken}`)
      return success(res, {
        resetToken: rawToken,
        expiresIn: '1小时',
        _note: '开发环境直接返回令牌；生产环境应通过邮件发送'
      }, '密码重置令牌已生成（开发模式）')
    }

    // TODO: 生产环境接入邮件服务发送重置链接
    // await sendPasswordResetEmail(email, rawToken)

    return success(res, null, '如果该邮箱已注册，重置链接已发送')

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/reset-password
 * 重置密码 — 使用令牌设置新密码
 *
 * 流程：
 * 1. 根据邮箱查找用户
 * 2. 验证重置令牌是否匹配且未过期
 * 3. 更新密码并清除重置令牌
 */
async function resetPassword(req, res, next) {
  try {
    const { email, token, newPassword } = req.body

    const user = await User.findOne({ where: { email } })
    if (!user) {
      return error(res, 'VALIDATION_ERROR', '无效的重置请求', 400)
    }

    // 验证令牌是否存在
    if (!user.reset_token || !user.reset_token_expires_at) {
      return error(res, 'VALIDATION_ERROR', '未发起密码重置请求，请先点击"忘记密码"', 400)
    }

    // 验证令牌是否过期
    if (new Date() > new Date(user.reset_token_expires_at)) {
      // 清除过期令牌
      user.reset_token = null
      user.reset_token_expires_at = null
      await user.save()
      return error(res, 'TOKEN_EXPIRED', '重置令牌已过期（有效期1小时），请重新发起重置', 400)
    }

    // 验证令牌是否匹配
    const isTokenValid = await bcrypt.compare(token, user.reset_token)
    if (!isTokenValid) {
      return error(res, 'VALIDATION_ERROR', '重置令牌无效', 400)
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword
    user.reset_token = null
    user.reset_token_expires_at = null
    await user.save()

    return success(res, null, '密码重置成功，请使用新密码登录')

  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, refresh, me, forgotPassword, resetPassword }
