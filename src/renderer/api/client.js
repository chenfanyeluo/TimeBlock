/**
 * API HTTP 客户端
 *
 * 基于 fetch 的封装，自动处理：
 * - JWT Token 认证（自动携带 Authorization 头）
 * - 错误处理与响应解析
 * - 网络状态检测
 */

// API 基础 URL（可通过环境变量配置）
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Token 存储 Key
const TOKEN_KEY = 'timeblock_access_token'

/**
 * 获取存储的 JWT Token
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 存储 JWT Token
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

/**
 * 清除 Token
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 检查是否已登录（有 Token）
 */
export function isLoggedIn() {
  return !!getToken()
}

/**
 * 核心请求函数
 *
 * @param {string} endpoint - API 路径（如 '/auth/login'）
 * @param {Object} options - fetch 选项
 * @returns {Promise<Object>} 响应数据
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  // 默认 Headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // 自动携带 JWT Token（除非是登录/注册接口）
  const token = getToken()
  if (token && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 构建请求配置
  const config = {
    ...options,
    headers
  }

  // 如果有 body 且是对象，自动序列化
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  try {
    const response = await fetch(url, config)

    // 解析响应
    const data = await response.json()

    // 处理业务错误
    if (!response.ok || data.success === false) {
      const error = new Error(data.message || '请求失败')
      error.code = data.code || 'UNKNOWN'
      error.status = response.status
      error.data = data
      throw error
    }

    return data

  } catch (err) {
    // 网络错误
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const networkError = new Error('网络连接失败，请检查网络或服务器状态')
      networkError.code = 'NETWORK_ERROR'
      throw networkError
    }

    // 其他错误
    throw err
  }
}

/**
 * GET 请求
 */
export function get(endpoint, params = {}) {
  // 构建查询字符串
  const queryStr = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')

  const fullEndpoint = queryStr ? `${endpoint}?${queryStr}` : endpoint

  return request(fullEndpoint, { method: 'GET' })
}

/**
 * POST 请求
 */
export function post(endpoint, body = {}) {
  return request(endpoint, { method: 'POST', body })
}

/**
 * PUT 请求
 */
export function put(endpoint, body = {}) {
  return request(endpoint, { method: 'PUT', body })
}

/**
 * DELETE 请求
 */
export function del(endpoint, body = null) {
  return request(endpoint, { method: 'DELETE', body })
}

// 导出默认客户端
export default {
  get,
  post,
  put,
  del,
  getToken,
  setToken,
  clearToken,
  isLoggedIn
}