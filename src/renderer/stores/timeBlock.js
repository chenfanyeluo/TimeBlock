import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

export const useTimeBlockStore = defineStore('timeBlock', () => {
  const blocks = ref([
    { id: 1, taskName: '晨会', category: 'work', startTime: '09:00', endTime: '09:30', date: dayjs().format('YYYY-MM-DD') },
    { id: 2, taskName: '项目开发', category: 'work', startTime: '09:30', endTime: '12:00', date: dayjs().format('YYYY-MM-DD') },
    { id: 3, taskName: '午休', category: 'rest', startTime: '12:00', endTime: '13:30', date: dayjs().format('YYYY-MM-DD') },
    { id: 4, taskName: '代码审查', category: 'work', startTime: '14:00', endTime: '16:00', date: dayjs().format('YYYY-MM-DD') },
    { id: 5, taskName: '学习新技术', category: 'study', startTime: '16:30', endTime: '18:00', date: dayjs().format('YYYY-MM-DD') }
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
