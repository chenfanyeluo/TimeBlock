const { error } = require('../utils/response')

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.stack || err.message || err)

  // Sequelize 验证错误
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const details = err.errors?.map(e => ({
      field: e.path,
      message: e.message
    }))
    return error(res, 'VALIDATION_ERROR', '请求参数验证失败', 400, details)
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'UNAUTHORIZED', '令牌无效', 401)
  }
  if (err.name === 'TokenExpiredError') {
    return error(res, 'UNAUTHORIZED', '令牌已过期', 401)
  }

  // 通用错误
  const statusCode = err.statusCode || 500
  const code = err.code || 'INTERNAL_ERROR'
  const message = err.message || '服务器内部错误'

  return error(res, code, message, statusCode)
}

module.exports = errorHandler
