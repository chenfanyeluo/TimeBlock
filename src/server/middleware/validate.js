const { validationResult } = require('express-validator')
const { error } = require('../utils/response')

/**
 * 验证结果检查中间件
 * 配合 express-validator 使用，如果有验证错误则返回 400
 */
function validate(req, res, next) {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    const details = errors.array().map(e => ({
      field: e.path,
      message: e.msg
    }))
    return error(res, 'VALIDATION_ERROR', '请求参数验证失败', 400, details)
  }

  next()
}

module.exports = validate
