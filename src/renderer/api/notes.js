/**
 * 便签 API
 */
import client from './client'

export async function getNotes() {
  const res = await client.get('/notes')
  return res.data
}

export async function createNote(data) {
  const res = await client.post('/notes', data)
  return res.data
}

export async function updateNote(id, data) {
  const res = await client.put(`/notes/${id}`, data)
  return res.data
}

export async function deleteNote(id) {
  const res = await client.del(`/notes/${id}`)
  return res.success
}

export default { getNotes, createNote, updateNote, deleteNote }
