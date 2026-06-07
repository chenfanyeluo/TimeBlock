import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

export const useTimeBlockStore = defineStore('timeBlock', () => {
  const blocks = ref([
    // 单任务示例
    { id: 1, taskName: '项目开发', categoryColor: '#00BCD4', categoryName: '工作', startTime: '01:15', endTime: '03:45', date: dayjs().format('YYYY-MM-DD') },
    // 同一时间段多任务示例（6:00-7:00 放置两个任务）
    { id: 2, taskName: '起床', categoryColor: '#FF9800', categoryName: '日常', startTime: '05:45', endTime: '07:15', date: dayjs().format('YYYY-MM-DD') },
    { id: 3, taskName: '背单词', categoryColor: '#2196F3', categoryName: '学习', startTime: '05:45', endTime: '07:15', date: dayjs().format('YYYY-MM-DD') },
    // 单任务示例
    { id: 4, taskName: '项目开发', categoryColor: '#00BCD4', categoryName: '工作', startTime: '08:45', endTime: '09:15', date: dayjs().format('YYYY-MM-DD') }
  ])

  const categories = ref([
    { id: 'work', name: '工作', color: '#409eff' },
    { id: 'study', name: '学习', color: '#67c23a' },
    { id: 'rest', name: '休息', color: '#e6a23c' },
    { id: 'entertainment', name: '娱乐', color: '#f56c6c' },
    { id: 'exercise', name: '运动', color: '#9254de' },
    { id: 'other', name: '其他', color: '#909399' }
  ])

  const currentDate = ref(dayjs())

  const getBlocksByDate = computed(() => (date) => {
    return blocks.value.filter(b => b.date === date)
  })

  const getBlocksByWeek = computed(() => (startDate) => {
    const start = dayjs(startDate)
    const end = start.add(6, 'day')
    return blocks.value.filter(b => {
      const d = dayjs(b.date)
      return d.isAfter(start.subtract(1, 'day')) && d.isBefore(end.add(1, 'day'))
    })
  })

  const getBlocksByMonth = computed(() => (year, month) => {
    return blocks.value.filter(b => {
      const d = dayjs(b.date)
      return d.year() === year && d.month() === month
    })
  })

  function addBlock(block) {
    blocks.value.push({
      id: Date.now(),
      ...block
    })
  }

  function updateBlock(id, updates) {
    const idx = blocks.value.findIndex(b => b.id === id)
    if (idx !== -1) {
      blocks.value[idx] = { ...blocks.value[idx], ...updates }
    }
  }

  function deleteBlock(id) {
    blocks.value = blocks.value.filter(b => b.id !== id)
  }

  function getCategoryColor(categoryId) {
    const cat = categories.value.find(c => c.id === categoryId)
    return cat?.color || '#909399'
  }

  function getCategoryName(categoryId) {
    const cat = categories.value.find(c => c.id === categoryId)
    return cat?.name || '其他'
  }

  return {
    blocks,
    categories,
    currentDate,
    getBlocksByDate,
    getBlocksByWeek,
    getBlocksByMonth,
    addBlock,
    updateBlock,
    deleteBlock,
    getCategoryColor,
    getCategoryName
  }
})
