/**
 * 认证 API
 *
 * 用户登录、注册、Token 管理
 */

import client, { setToken, clearToken, getToken, setUserId, clearUserId } from './client'

/**
 * 用户登录
 *
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Promise<{ accessToken, user }>}
 */
export async function login(email, password) {
  const response = await client.post('/auth/login', { email, password })

  if (response.success && response.data?.accessToken) {
    // 存储 Token 和用户 ID
    setToken(response.data.accessToken)
    setUserId(response.data.user?.id)
    return response.data
  }

  throw new Error(response.message || '登录失败')
}

/**
 * 用户注册
 *
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @param {string} name - 用户名
 * @returns {Promise<{ accessToken, user }>}
 */
export async function register(email, password, name) {
  const response = await client.post('/auth/register', { email, password, name })

  if (response.success && response.data?.accessToken) {
    // 存储 Token 和用户 ID
    setToken(response.data.accessToken)
    setUserId(response.data.user?.id)
    return response.data
  }

  throw new Error(response.message || '注册失败')
}

/**
 * 退出登录（清除本地 Token 和用户 ID）
 */
export function logout() {
  clearToken()
  clearUserId()
}

/**
 * 刷新 Token
 *
 * @returns {Promise<{ accessToken }>}
 */
export async function refreshToken() {
  const response = await client.post('/auth/refresh')

  if (response.success && response.data?.accessToken) {
    setToken(response.data.accessToken)
    return response.data
  }

  // Token 刷新失败，清除旧 Token
  clearToken()
  clearUserId()
  throw new Error(response.message || 'Token刷新失败')
}

/**
 * 获取当前用户信息
 *
 * @returns {Promise<Object>} 用户信息
 */
export async function getCurrentUser() {
  const response = await client.get('/auth/me')

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '获取用户信息失败')
}

/**
 * 检查是否已登录
 */
export function checkLogin() {
  return client.isLoggedIn()
}

/**
 * 获取当前 Token
 */
export function getStoredToken() {
  return getToken()
}

/**
 * 请求密码重置
 *
 * @param {string} email 邮箱
 * @returns {Promise<{ message, resetToken?, expiresIn }>}
 */
export async function forgotPassword(email) {
  const response = await client.post('/auth/forgot-password', { email })

  if (response.success) {
    return response.data
  }

  throw new Error(response.message || '请求密码重置失败')
}

/**
 * 使用Token重置密码
 *
 * @param {string} token 重置Token
 * @param {string} newPassword 新密码
 * @returns {Promise<{ accessToken, user, message }>}
 */
export async function resetPassword(token, newPassword) {
  const response = await client.post('/auth/reset-password', { token, newPassword })

  if (response.success && response.data?.accessToken) {
    // 存储 Token 和用户 ID（自动登录）
    setToken(response.data.accessToken)
    setUserId(response.data.user?.id)
    return response.data
  }

  throw new Error(response.message || '重置密码失败')
}

/**
 * 账号注销（需密码二次确认）
 *
 * @param {string} password 登录密码
 * @returns {Promise<{ deletedAt }>}
 */
export async function deleteAccount(password) {
  const response = await client.del('/users/account', { password })

  if (response.success) {
    clearToken()
    clearUserId()
    return response.data
  }

  throw new Error(response.message || '账号注销失败')
}

export default {
  login,
  register,
  logout,
  refreshToken,
  getCurrentUser,
  checkLogin,
  getStoredToken,
  forgotPassword,
  resetPassword,
  deleteAccount
}