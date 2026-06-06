const jwt = require('jsonwebtoken')
const { User } = require('../models')
const { error } = require('../utils/response')
require('dotenv').config()

const JWT_SECRET = process.env.JWT_SECRET || 'timeblock-jwt-secret-key'

/**
 * JWT 认证中间件
 * 验证请求中的 Bearer Token，将用户信息注入 req.user
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'UNAUTHORIZED', '未提供认证令牌，请先登录', 401)
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
      return error(res, 'UNAUTHORIZED', '令牌格式错误', 401)
    }

    // 验证 JWT
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return error(res, 'UNAUTHORIZED', '令牌已过期，请重新登录', 401)
      }
      return error(res, 'UNAUTHORIZED', '令牌验证失败', 401)
    }

    // 查找用户
    const user = await User.findByPk(decoded.sub, {
      attributes: { exclude: ['password'] }
    })

    if (!user) {
      return error(res, 'UNAUTHORIZED', '用户不存在或已被删除', 401)
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 可选认证中间件
 * 如果提供了 Token 则验证并注入用户，否则继续但 req.user 为 null
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null
      return next()
    }

    const token = authHeader.split(' ')[1]

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.user = await User.findByPk(decoded.sub, {
        attributes: { exclude: ['password'] }
      })
    } catch {
      req.user = null
    }

    next()
  } catch (err) {
    next(err)
  }
}

module.exports = { authenticate, optionalAuth }
