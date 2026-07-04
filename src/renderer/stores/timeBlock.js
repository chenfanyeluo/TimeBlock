import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { storage } from '@shared/platform'
import { platformInfo, database } from '@shared/platform'

/**
 * 检查是否支持数据库（Electron 或 Capacitor）
 */
function supportsDatabase() {
  return platformInfo.isElectron || platformInfo.isCapacitor
}

/**
 * 检查是否在 Electron 环境中（旧函数，保留兼容）
 */
function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI
}

/**
 * 时间块数据格式转换（数据库 → 前端）
 */
function dbBlockToFrontend(dbBlock) {
  return {
    id: dbBlock.id,
    noteId: dbBlock.note_id,
    noteName: dbBlock.note_name || '未分类',
    noteColor: dbBlock.note_color || '#909399',
    title: dbBlock.title,
    description: dbBlock.description,
    startTime: dayjs(dbBlock.start_time).format('HH:mm'),
    endTime: dayjs(dbBlock.end_time).format('HH:mm'),
    date: dayjs(dbBlock.start_time).format('YYYY-MM-DD'),
    isCompleted: dbBlock.is_completed === 1,
    remark: dbBlock.description || '',
    note: dbBlock.description || ''  // 添加 note 字段，与 TimeBlockItem.vue 保持一致
  }
}

/**
 * 时间块数据格式转换（前端 → 数据库）
 */
function frontendBlockToDb(block) {
  const date = block.date || dayjs().format('YYYY-MM-DD')
  return {
    note_id: block.noteId || null,
    title: block.title || block.noteName || '未命名',
    description: block.remark || block.note || block.description || null,  // 添加 note 字段处理
    start_time: `${date}T${block.startTime}:00`,  // 使用本地时间，避免UTC时区偏移
    end_time: `${date}T${block.endTime}:00`,      // 使用本地时间，避免UTC时区偏移
    is_completed: block.isCompleted ? 1 : 0
  }
}

export const useTimeBlockStore = defineStore('timeBlock', () => {
  // ---- 主题管理（含 storage 持久化 + 系统跟随）----
  const THEME_KEY = 'timeblock-theme'
  const VALID_THEMES = ['light', 'dark', 'green', 'warm', 'blue', 'contrast', 'auto']

  /** 主题状态（初始值 'light'，异步加载后更新） */
  const theme = ref('light')

  /** 从 storage 异步加载主题 */
  async function loadTheme() {
    const storedTheme = await storage.get(THEME_KEY)
    if (VALID_THEMES.includes(storedTheme)) {
      theme.value = storedTheme
    }
    applyThemeToDOM(getAppliedTheme())
  }

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
  async function setTheme(val) {
    if (!VALID_THEMES.includes(val)) return
    theme.value = val
    await storage.set(THEME_KEY, val)
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

  // 初始化：异步加载主题 + 启动系统监听
  loadTheme()
  watchSystemTheme()

  // ---- 动画开关（含 storage 持久化）----
  const ANIMATION_KEY = 'timeblock-animation-enabled'
  const animationEnabled = ref(true) // 默认开启

  /** 从 storage 异步加载动画设置 */
  async function loadAnimation() {
    const storedValue = await storage.get(ANIMATION_KEY)
    if (storedValue === 'false') {
      animationEnabled.value = false
      document.documentElement.setAttribute('data-animation-disabled', '')
    }
  }

  /** 设置动画开关并持久化 */
  async function setAnimationEnabled(val) {
    animationEnabled.value = val
    await storage.set(ANIMATION_KEY, String(val))
    // 通过切换根元素 data 属性控制全局动画
    if (val) {
      document.documentElement.removeAttribute('data-animation-disabled')
    } else {
      document.documentElement.setAttribute('data-animation-disabled', '')
    }
  }

  // 异步加载动画设置
  loadAnimation()

  // ---- 时间粒度设置（含 storage 持久化）----
  const GRANULARITY_KEY = 'timeblock-granularity'
  const VALID_GRANULARITIES = [15, 30, 60] // 15分钟、30分钟、1小时

  /** 时间粒度状态（单位：分钟，默认 15） */
  const timeGranularity = ref(15)

  /** 从 storage 异步加载时间粒度 */
  async function loadGranularity() {
    const storedValue = await storage.get(GRANULARITY_KEY)
    const parsed = parseInt(storedValue, 10)
    if (VALID_GRANULARITIES.includes(parsed)) {
      timeGranularity.value = parsed
    }
  }

  /** 设置时间粒度并持久化 */
  async function setGranularity(val) {
    const numVal = parseInt(val, 10)
    if (!VALID_GRANULARITIES.includes(numVal)) return
    timeGranularity.value = numVal
    await storage.set(GRANULARITY_KEY, String(numVal))
  }

  // 异步加载时间粒度
  loadGranularity()

  // ---- 时间块数据 ----
  const blocks = ref([])
  const notes = ref([])
  const currentDate = ref(dayjs())

  /** 数据库加载状态 */
  const isDataLoaded = ref(false)

  /**
   * 从数据库加载便签
   */
  async function loadNotesFromDB() {
    console.log('[Store] loadNotesFromDB - platformInfo:', platformInfo)
    
    if (!supportsDatabase()) {
      // 不支持数据库的平台（Web），使用默认便签
      console.log('[Store] 平台不支持数据库，使用默认便签')
      notes.value = [
        { id: 'work', name: '工作', color: '#409eff' },
        { id: 'study', name: '学习', color: '#67c23a' },
        { id: 'rest', name: '休息', color: '#e6a23c' },
        { id: 'exercise', name: '运动', color: '#f56c6c' },
        { id: 'life', name: '生活', color: '#9254de' },
        { id: 'other', name: '其他', color: '#909399' }
      ]
      return
    }

    try {
      if (platformInfo.isCapacitor) {
        // Capacitor 平台：直接使用 database 适配层
        console.log('[Store] Capacitor 平台：从数据库加载便签')
        const result = await database.query('SELECT * FROM notes WHERE user_id = 1 AND deleted_at IS NULL')
        notes.value = result.map(note => ({
          id: note.id,
          name: note.name,
          color: note.color
        }))
        console.log('[Store] Capacitor 加载便签:', notes.value.length, notes.value)
      } else if (isElectron()) {
        // Electron 平台：使用 IPC
        console.log('[Store] Electron 平台：从数据库加载便签')
        const result = await window.electronAPI.getAllNotes()
        if (result.success && result.data) {
          notes.value = result.data.map(note => ({
            id: note.id,
            name: note.name,
            color: note.color
          }))
          console.log('[Store] Electron 加载便签:', notes.value.length)
        }
      }
    } catch (err) {
      console.error('[Store] 加载便签失败:', err)
      // 失败时使用默认便签
      notes.value = [
        { id: 'work', name: '工作', color: '#409eff' },
        { id: 'study', name: '学习', color: '#67c23a' },
        { id: 'rest', name: '休息', color: '#e6a23c' },
        { id: 'exercise', name: '运动', color: '#f56c6c' },
        { id: 'life', name: '生活', color: '#9254de' },
        { id: 'other', name: '其他', color: '#909399' }
      ]
    }
  }

  /**
   * 从数据库加载指定日期的时间块
   */
  async function loadBlocksByDateFromDB(date) {
    console.log('[Store] loadBlocksByDateFromDB - date:', date, 'platformInfo:', platformInfo)
    
    if (!supportsDatabase()) {
      console.log('[Store] 平台不支持数据库，跳过加载时间块')
      return
    }

    try {
      if (platformInfo.isCapacitor) {
        // Capacitor 平台：直接使用 database 适配层
        console.log('[Store] Capacitor 平台：从数据库加载时间块', date)
        
        const querySQL = `
          SELECT tb.*, n.name as note_name, n.color as note_color 
          FROM time_blocks tb 
          LEFT JOIN notes n ON tb.note_id = n.id 
          WHERE tb.user_id = 1 
            AND DATE(tb.start_time) = DATE(?)
            AND tb.deleted_at IS NULL
          ORDER BY tb.start_time ASC
        `
        
        const result = await database.query(querySQL, [date])
        console.log('[Store] Capacitor 查询结果:', result.length)
        
        const newBlocks = result.map(dbBlockToFrontend)
        
        // 合并到现有 blocks（避免重复）
        const existingIds = new Set(blocks.value.map(b => b.id))
        for (const block of newBlocks) {
          if (!existingIds.has(block.id)) {
            blocks.value.push(block)
          }
        }
        console.log('[Store] Capacitor 加载时间块成功:', date, newBlocks.length, newBlocks)
      } else if (isElectron()) {
        // Electron 平台：使用 IPC
        console.log('[Store] Electron 平台：从数据库加载时间块', date)
        const result = await window.electronAPI.getTimeBlocksByDate(date)
        if (result.success && result.data) {
          const newBlocks = result.data.map(dbBlockToFrontend)
          // 合并到现有 blocks（避免重复）
          const existingIds = new Set(blocks.value.map(b => b.id))
          for (const block of newBlocks) {
            if (!existingIds.has(block.id)) {
              blocks.value.push(block)
            }
          }
          console.log('[Store] Electron 加载时间块:', date, newBlocks.length)
        }
      }
    } catch (err) {
      console.error('[Store] 加载时间块失败:', err)
    }
  }

  /**
   * 初始化数据加载
   */
  async function initData() {
    if (isDataLoaded.value) return

    await loadNotesFromDB()
    await loadBlocksByDateFromDB(dayjs().format('YYYY-MM-DD'))
    isDataLoaded.value = true
    console.log('[Store] 数据初始化完成')
  }

  // 自动初始化
  initData()

  // ---- 撤销/重做机制 ----
  const MAX_HISTORY = 50
  const undoStack = ref([])
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
    redoStack.value = []
  }

  /** 撤销 */
  function undo() {
    if (undoStack.value.length === 0) return false
    redoStack.value.push({
      blocksSnapshot: JSON.parse(JSON.stringify(blocks.value))
    })
    if (redoStack.value.length > MAX_HISTORY) {
      redoStack.value.shift()
    }
    const prev = undoStack.value.pop()
    blocks.value = prev.blocksSnapshot
    return true
  }

  /** 重做 */
  function redo() {
    if (redoStack.value.length === 0) return false
    undoStack.value.push({
      blocksSnapshot: JSON.parse(JSON.stringify(blocks.value))
    })
    const next = redoStack.value.pop()
    blocks.value = next.blocksSnapshot
    return true
  }

  // ---- 计算属性 ----

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

  // ---- 时间块操作（同步到数据库）----

  /**
   * 添加时间块
   */
  async function addBlock(block) {
    console.log('[Store] addBlock - platformInfo:', platformInfo, 'block:', block)
    pushHistory('添加时间块')

    if (supportsDatabase()) {
      try {
        const dbData = frontendBlockToDb(block)
        console.log('[Store] 转换后的数据库数据:', dbData)
        
        if (platformInfo.isCapacitor) {
          // Capacitor 平台：直接使用 database 适配层
          console.log('[Store] Capacitor 平台：写入数据库')
          
          const insertSQL = `
            INSERT INTO time_blocks (user_id, note_id, title, description, start_time, end_time, is_completed)
            VALUES (1, ?, ?, ?, ?, ?, ?)
          `
          
          const result = await database.run(insertSQL, [
            dbData.note_id,
            dbData.title,
            dbData.description,
            dbData.start_time,
            dbData.end_time,
            dbData.is_completed
          ])
          
          console.log('[Store] Capacitor 写入结果:', result)
          
          if (result.lastInsertRowid) {
            // 查询刚插入的记录（包含便签信息）
            const querySQL = `
              SELECT tb.*, n.name as note_name, n.color as note_color 
              FROM time_blocks tb 
              LEFT JOIN notes n ON tb.note_id = n.id 
              WHERE tb.id = ?
            `
            const newRecord = await database.query(querySQL, [result.lastInsertRowid])
            console.log('[Store] Capacitor 查询新记录:', newRecord)
            
            if (newRecord.length > 0) {
              const newBlock = dbBlockToFrontend(newRecord[0])
              blocks.value.push(newBlock)
              console.log('[Store] ✅ Capacitor 创建时间块成功:', newBlock.id, newBlock)
              return newBlock
            }
          }
        } else if (isElectron()) {
          // Electron 平台：使用 IPC
          console.log('[Store] Electron 平台：写入数据库')
          const result = await window.electronAPI.createTimeBlock(dbData)
          if (result.success && result.data) {
            const newBlock = dbBlockToFrontend(result.data)
            blocks.value.push(newBlock)
            console.log('[Store] Electron 创建时间块:', newBlock.id)
            return newBlock
          }
        }
      } catch (err) {
        console.error('[Store] 创建时间块失败:', err)
      }
    }

    // 不支持数据库或失败时，使用本地 ID（仅内存，不持久化）
    console.log('[Store] ⚠️ 使用本地模式（不持久化）')
    const localBlock = {
      id: Date.now(),
      ...block
    }
    blocks.value.push(localBlock)
    return localBlock
  }

  /**
   * 更新时间块
   */
  async function updateBlock(id, updates) {
    pushHistory('修改时间块')

    const idx = blocks.value.findIndex(b => b.id === id)
    if (idx === -1) return null

    if (isElectron()) {
      try {
        const dbData = frontendBlockToDb({ ...blocks.value[idx], ...updates })
        const result = await window.electronAPI.updateTimeBlock(id, dbData)
        if (result.success && result.data) {
          const updatedBlock = dbBlockToFrontend(result.data)
          blocks.value[idx] = updatedBlock
          console.log('[Store] 更新时间块:', id)
          return updatedBlock
        }
      } catch (err) {
        console.error('[Store] 更新时间块失败:', err)
      }
    }

    // 非 Electron 环境或失败时，本地更新
    blocks.value[idx] = { ...blocks.value[idx], ...updates }
    return blocks.value[idx]
  }

  /**
   * 删除时间块
   */
  async function deleteBlock(id) {
    pushHistory('删除时间块')

    if (isElectron()) {
      try {
        const result = await window.electronAPI.deleteTimeBlock(id)
        if (result.success) {
          blocks.value = blocks.value.filter(b => b.id !== id)
          console.log('[Store] 删除时间块:', id)
          return true
        }
      } catch (err) {
        console.error('[Store] 删除时间块失败:', err)
      }
    }

    // 非 Electron 环境或失败时，本地删除
    blocks.value = blocks.value.filter(b => b.id !== id)
    return true
  }

  /**
   * 加载更多日期的时间块（用于切换日期时）
   */
  async function loadMoreBlocks(date) {
    await loadBlocksByDateFromDB(date)
  }

  // ---- 便签辅助函数 ----

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
    isDataLoaded,
    // 主题管理
    theme,
    setTheme,
    // 动画开关
    animationEnabled,
    setAnimationEnabled,
    // 时间粒度
    timeGranularity,
    setGranularity,
    // 计算属性
    getBlocksByDate,
    getBlocksByWeek,
    getBlocksByMonth,
    getBlocksByYear,
    // 时间块操作
    addBlock,
    updateBlock,
    deleteBlock,
    loadMoreBlocks,
    initData,
    // 便签辅助
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