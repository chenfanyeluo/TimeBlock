/**
 * 导入导出 API
 */
import client from './client'

export async function exportData(format = 'json') {
  const res = await client.get('/export', { format })
  return res.data
}

export async function importData(data) {
  const res = await client.post('/import', data)
  return res.data
}

export default { exportData, importData }
