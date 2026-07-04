/**
 * 统计 API
 */
import client from './client'

export async function getDailyStats(date) {
  const res = await client.get('/statistics/daily', { date })
  return res.data
}

export async function getWeeklyStats(startDate, endDate) {
  const res = await client.get('/statistics/weekly', { startDate, endDate })
  return res.data
}

export async function getMonthlyStats(year, month) {
  const res = await client.get('/statistics/monthly', { year, month })
  return res.data
}

export default { getDailyStats, getWeeklyStats, getMonthlyStats }
