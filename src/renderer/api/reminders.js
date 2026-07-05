/**
 * 提醒 API
 */
import client from './client'

export async function getDueReminders() {
  const res = await client.get('/reminders/due/pending')
  return res.data
}

export async function getReminders(params = {}) {
  const res = await client.get('/reminders', params)
  return res.data
}

export async function getReminder(id) {
  const res = await client.get(`/reminders/${id}`)
  return res.data
}

export async function createReminder(data) {
  const res = await client.post('/reminders', data)
  return res.data
}

export async function updateReminder(id, data) {
  const res = await client.put(`/reminders/${id}`, data)
  return res.data
}

export async function dismissReminder(id) {
  const res = await client.post(`/reminders/${id}/dismiss`)
  return res.data
}

export async function triggerReminder(id) {
  const res = await client.post(`/reminders/${id}/trigger`)
  return res.data
}

export async function cancelReminder(id) {
  const res = await client.post(`/reminders/${id}/cancel`)
  return res.data
}

export async function deleteReminder(id) {
  const res = await client.del(`/reminders/${id}`)
  return res.success
}

export default {
  getDueReminders, getReminders, getReminder,
  createReminder, updateReminder,
  dismissReminder, triggerReminder, cancelReminder,
  deleteReminder
}
