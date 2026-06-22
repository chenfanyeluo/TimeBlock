import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

export const useTimeBlockStore = defineStore('timeBlock', () => {
  // ---- 主题管理（含 localStorage 持久化 + 系统跟随）----
  const THEME_KEY = 'timeblock-theme'
  const VALID_THEMES = ['light', 'dark', 'green', 'warm', 'blue', 'contrast', 'auto']

  /** 从 localStorage 读取主题，非法值回退到 'light' */
  const storedTheme = localStorage.getItem(THEME_KEY)
  const theme = ref(VALID_THEMES.includes(storedTheme) ? storedTheme : 'light')

  /** 根据系统偏好推断实际主题 */
  function getSystemPreferredTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  /** 获取当前生效的主题（auto 时解析为 light 或 dark） */
  function getAppliedTheme() {
    if (theme.value === 'auto') return getSystemPreferredTheme()
    return theme.value
  }

  /** 将主题应用到 DOM */
  function applyThemeToDOM(applied) {
    const root = document.documentElement
    if (applied === 'light') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', applied)
    }
  }

  /** 设置主题并持久化 */
  function setTheme(val) {
    if (!VALID_THEMES.includes(val)) return
    theme.value = val
    localStorage.setItem(THEME_KEY, val)
    applyThemeToDOM(getAppliedTheme())
  }

  // auto 模式下监听系统主题变化
  let systemThemeListener = null
  function watchSystemTheme() {
    if (systemThemeListener) return // 避免重复绑定
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    systemThemeListener = () => {
      if (theme.value === 'auto') {
        applyThemeToDOM(getAppliedTheme())
      }
    }
    mq.addEventListener('change', systemThemeListener)
  }

  // 初始化：同步状态到 DOM + 启动系统监听
  applyThemeToDOM(getAppliedTheme())
  watchSystemTheme()

  // ---- 动画开关（含 localStorage 持久化）----
  const ANIMATION_KEY = 'timeblock-animation-enabled'
  const animationEnabled = ref(
    localStorage.getItem(ANIMATION_KEY) !== 'false' // 默认开启
  )

  function setAnimationEnabled(val) {
    animationEnabled.value = val
    localStorage.setItem(ANIMATION_KEY, String(val))
    // 通过切换根元素 data 属性控制全局动画
    if (val) {
      document.documentElement.removeAttribute('data-animation-disabled')
    } else {
      document.documentElement.setAttribute('data-animation-disabled', '')
    }
  }

  // 初始化时同步状态到 DOM
  if (!animationEnabled.value) {
    document.documentElement.setAttribute('data-animation-disabled', '')
  }

  const blocks = ref([
    // 示例数据
    { id: 1, noteId: 'work', noteName: '项目开发', noteColor: '#00BCD4', startTime: '09:00', endTime: '11:30', date: dayjs().format('YYYY-MM-DD') },
    { id: 2, noteId: 'exercise', noteName: '晨跑', noteColor: '#F44336', startTime: '06:30', endTime: '07:15', date: dayjs().format('YYYY-MM-DD') },
    { id: 3, noteId: 'study', noteName: '背单词', noteColor: '#2196F3', startTime: '08:00', endTime: '08:30', date: dayjs().format('YYYY-MM-DD') },
    { id: 4, noteId: 'study', noteName: '阅读', noteColor: '#9C27B0', startTime: '20:00', endTime: '21:30', date: dayjs().format('YYYY-MM-DD'), remark: '读《深入理解计算机系统》' }
  ])

  // 便签列表（每个便签 = 颜色标签，拖入时间轴即创建时间块）
  const notes = ref([
    { id: 'work', name: '工作', color: '#409eff' },
    { id: 'study', name: '学习', color: '#67c23a' },
    { id: 'rest', name: '休息', color: '#e6a23c' },
    { id: 'exercise', name: '运动', color: '#f56c6c' },
    { id: 'life', name: '生活', color: '#9254de' },
    { id: 'other', name: '其他', color: '#909399' }
  ])

  const currentDate = ref(dayjs())

  // ---- 撤销/重做机制 ----
  const MAX_HISTORY = 50
  const undoStack = ref([])   // 存储快照：{ blocksSnapshot, actionDesc }
  const redoStack = ref([])

  /** 保存当前状态到撤销栈 */
  function pushHistory(actionDesc = '') {
    undoStack.value.push({
      blocksSnapshot: JSON.parse(JSON.stringify(blocks.value)),
      actionDesc
    })
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    // 新操作清空重做栈
    redoStack.value = []
  }

  /** 撤销 */
  function undo() {
    if (undoStack.value.length === 0) return false
    // 当前状态存入重做栈
    redoStack.value.push({
      blocksSnapshot: JSON.parse(JSON.stringify(blocks.value))
    })
    if (redoStack.value.length > MAX_HISTORY) {
      redoStack.value.shift()
    }
    // 恢复上一次状态
    const prev = undoStack.value.pop()
    blocks.value = prev.blocksSnapshot
    return true
  }

  /** 重做 */
  function redo() {
    if (redoStack.value.length === 0) return false
    // 当前状态存入撤销栈
    undoStack.value.push({
      blocksSnapshot: JSON.parse(JSON.stringify(blocks.value))
    })
    // 恢复重做状态
    const next = redoStack.value.pop()
    blocks.value = next.blocksSnapshot
    return true
  }

  // ---- 原有计算属性与方法（增加撤销点）----

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

  const getBlocksByYear = computed(() => (year) => {
    return blocks.value.filter(b => {
      return dayjs(b.date).year() === year
    })
  })

  function addBlock(block) {
    pushHistory('添加时间块')
    blocks.value.push({
      id: Date.now(),
      ...block
    })
  }

  function updateBlock(id, updates) {
    pushHistory('修改时间块')
    const idx = blocks.value.findIndex(b => b.id === id)
    if (idx !== -1) {
      blocks.value[idx] = { ...blocks.value[idx], ...updates }
    }
  }

  function deleteBlock(id) {
    pushHistory('删除时间块')
    blocks.value = blocks.value.filter(b => b.id !== id)
  }

  function getNoteColor(noteId) {
    const note = notes.value.find(n => n.id === noteId)
    return note?.color || '#909399'
  }

  function getNoteName(noteId) {
    const note = notes.value.find(n => n.id === noteId)
    return note?.name || '其他'
  }

  return {
    blocks,
    notes,
    currentDate,
    // 主题管理
    theme,
    setTheme,
    // 动画开关
    animationEnabled,
    setAnimationEnabled,
    getBlocksByDate,
    getBlocksByWeek,
    getBlocksByMonth,
    getBlocksByYear,
    addBlock,
    updateBlock,
    deleteBlock,
    getNoteColor,
    getNoteName,
    // 撤销/重做
    undo,
    redo,
    pushHistory,
    undoStack,
    redoStack
  }
})
