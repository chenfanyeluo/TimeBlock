const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User } = require('../models')
const { success, error } = require('../utils/response')

const JWT_SECRET = process.env.JWT_SECRET || 'timeblock-jwt-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
/** 密码重置令牌有效期（毫秒），默认 1 小时 */
const RESET_TOKEN_EXPIRES = 60 * 60 * 1000

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
 * 请求密码重置
 *
 * 生成重置Token并发送到用户邮箱（简化版：直接返回Token用于演示）
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body

    // 查找用户
    const user = await User.findOne({ where: { email } })
    if (!user) {
      // 不暴露用户是否存在的信息
      return success(res, { message: '如果邮箱已注册，重置链接将发送到您的邮箱' })
    }

    // 生成重置Token（随机32字节）
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_EXPIRES)

    // 存储Token到用户记录
    await user.update({
      reset_token: resetToken,
      reset_token_expires: resetTokenExpires
    })

    // 简化版：直接返回Token（实际应发送邮件）
    // 生产环境应配置邮件服务（如 nodemailer）
    console.log(`[Auth] 密码重置Token: ${resetToken} (邮箱: ${email})`)

    return success(res, {
      message: '重置Token已生成',
      // 简化演示：返回Token（生产环境应发送邮件，不返回Token）
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
      expiresIn: 3600 // 1小时
    })

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/reset-password
 * 使用Token重置密码
 */
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return error(res, 'BAD_REQUEST', 'Token和新密码不能为空', 400)
    }

    if (newPassword.length < 6) {
      return error(res, 'BAD_REQUEST', '密码长度至少6位', 400)
    }

    // 查找有效Token的用户
    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expires: { [require('sequelize').Op.gt]: new Date() }
      }
    })

    if (!user) {
      return error(res, 'BAD_REQUEST', '重置Token无效或已过期', 400)
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // 更新密码并清除Token
    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    })

    // 生成新的JWT Token（自动登录）
    const accessToken = generateToken(user)

    return success(res, {
      accessToken,
      user: sanitizeUser(user),
      message: '密码已重置成功'
    })

  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, refresh, me, forgotPassword, resetPassword }
