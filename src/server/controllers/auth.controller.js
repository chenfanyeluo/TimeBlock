const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User } = require('../models')
const { success, error } = require('../utils/response')

const JWT_SECRET = process.env.JWT_SECRET || 'timeblock-jwt-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

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

module.exports = { register, login, refresh, me }
