/**
 * 用户 API
 */
import client from './client'

export async function updateProfile(data) {
  const res = await client.put('/users/profile', data)
  return res.data
}

export async function changePassword(oldPassword, newPassword) {
  const res = await client.put('/users/password', { oldPassword, newPassword })
  return res.success
}

export async function deleteAccount(password) {
  const res = await client.del('/users/account', { password })
  return res.data
}

export default { updateProfile, changePassword, deleteAccount }
