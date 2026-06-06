/**
 * 统一响应格式工具
 * 符合 API 设计文档规范
 */

/**
 * 成功响应
 */
function success(res, data = null, message = '操作成功', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  })
}

/**
 * 分页响应
 */
function paginated(res, items, pagination, message = '操作成功') {
  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination
    },
    message
  })
}

/**
 * 错误响应
 */
function error(res, code, message, statusCode = 400, details = null) {
  const body = {
    success: false,
    error: {
      code,
      message
    }
  }
  if (details) {
    body.error.details = details
  }
  return res.status(statusCode).json(body)
}

module.exports = { success, paginated, error }
