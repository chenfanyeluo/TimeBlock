import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { storage } from '@shared/platform'
import { platformInfo, database } from '@shared/platform'
import { createTimeBlockReminder, cancelTimeBlockReminder, syncReminderAfterTimeBlockUpdate } from '../services/reminder'

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
  const startDayjs = dayjs(dbBlock.start_time)
  const endDayjs = dayjs(dbBlock.end_time)
  const startDate = startDayjs.format('YYYY-MM-DD')
  const endDate = endDayjs.format('YYYY-MM-DD')

  // 还原 24:00：
  //   - 新数据：frontendBlockToDb 已将 24:00 转为次日 00:00 存储
  //     → end 日期 > start 日期 且 HH:mm="00:00"
  //   - 旧数据：存储了无效的 "T24:00:00"，dayjs 也归一化为次日 00:00
  //     → end 日期 == start 日期 且 HH:mm="00:00"（同天 00:00 实际不存在]
  // 两种情况下若 end 的 HH:mm 为 00:00 且不是同一天同时间（即不是 00:00~00:00 的空块）
  let endTime = endDayjs.format('HH:mm')
  if (endTime === '00:00' && endDate > startDate) {
    // 新数据路径：end 在次日，确认为前一天的 24:00
    endTime = '24:00'
  } else if (endTime === '00:00' && startDate === endDate && startDayjs.format('HH:mm') !== '00:00') {
    // 旧数据兼容：同一天内 start≠00:00 但 end=00:00，说明是旧版 24:00 被归一化
    endTime = '24:00'
  }

  return {
    id: dbBlock.id,
    noteId: dbBlock.note_id,
    noteName: dbBlock.note_name || '未分类',
    noteColor: dbBlock.note_color || '#909399',
    title: dbBlock.title,
    taskName: dbBlock.title || '',
    description: dbBlock.description,
    startTime: startDayjs.format('HH:mm'),
    endTime: endTime,
    date: startDate,
    isCompleted: dbBlock.is_completed === 1,
    remark: dbBlock.description || '',
    note: dbBlock.description || ''
  }
}

/**
 * 时间块数据格式转换（前端 → 数据库）
 * 策略：避免存入无效的 "24:00"，结束于 24:00 的时间块以次日 00:00 存储
 *      读回时由 dbBlockToFrontend 检测还原
 */
function frontendBlockToDb(block) {
  const date = block.date || dayjs().format('YYYY-MM-DD')
  const startTime = `${date}T${block.startTime}:00`

  // 24:00 结束 → 转为次日 00:00 存储（ISO 8601 合法格式）
  let endTime
  if (block.endTime === '24:00') {
    const nextDate = dayjs(date).add(1, 'day').format('YYYY-MM-DD')
    endTime = `${nextDate}T00:00:00`
  } else {
    endTime = `${date}T${block.endTime}:00`
  }

  return {
    note_id: block.noteId || null,
    title: block.title || block.noteName || '未命名',
    description: block.remark || block.note || block.description || null,
    start_time: startTime,
    end_time: endTime,
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
        { id: 1, name: '工作', color: '#409eff', auto_remind: 0, default_advance_minutes: 5 },
        { id: 2, name: '学习', color: '#67c23a', auto_remind: 0, default_advance_minutes: 5 },
        { id: 3, name: '休息', color: '#e6a23c', auto_remind: 0, default_advance_minutes: 5 },
        { id: 4, name: '运动', color: '#f56c6c', auto_remind: 0, default_advance_minutes: 5 },
        { id: 5, name: '生活', color: '#9254de', auto_remind: 0, default_advance_minutes: 5 },
        { id: 6, name: '其他', color: '#909399', auto_remind: 0, default_advance_minutes: 5 }
      ]
      return
    }

    try {
      if (platformInfo.isCapacitor) {
        // Capacitor 平台：直接使用 database 适配层
        console.log('[Store] Capacitor 平台：从数据库加载便签')

        // ⚠️ 优化：立即尝试加载，如果数据库未初始化则等待最多 500ms（而不是 1秒）
        let retryCount = 0
        const maxRetry = 5  // 最多重试5次，每次100ms

        while (!database.isReady() && retryCount < maxRetry) {
          console.log(`[Store] 数据库未初始化，等待... (${retryCount + 1}/${maxRetry})`)
          await new Promise(resolve => setTimeout(resolve, 100))
          retryCount++
        }

        if (!database.isReady()) {
          console.warn('[Store] 数据库初始化超时，使用默认便签')
          await initDefaultNotes()
          return
        }

        const result = await database.query('SELECT * FROM notes WHERE user_id = 1 AND deleted_at IS NULL')
        console.log('[Store] Capacitor 查询结果:', result)

        if (result.length === 0) {
          console.warn('[Store] 数据库中没有便签数据，初始化默认便签')
          await initDefaultNotes()
          return
        }

        notes.value = result.map(note => ({
          id: note.id,  // ⚠️ 确保使用数字 ID
          name: note.name,
          color: note.color,
          auto_remind: Number(note.auto_remind || 0),  // 是否开启自动提醒
          default_advance_minutes: Number(note.default_advance_minutes || 5)  // 默认提前提醒分钟数
        }))
        console.log('[Store] ✅ Capacitor 加载便签成功:', notes.value.length, notes.value)
      } else if (isElectron()) {
        // Electron 平台：使用 IPC
        console.log('[Store] Electron 平台：从数据库加载便签')
        const result = await window.electronAPI.getAllNotes()
        if (result.success && result.data) {
          if (result.data.length === 0) {
            await initDefaultNotes()
            return
          }
          notes.value = result.data.map(note => ({
            id: note.id,  // ⚠️ 确保使用数字 ID
            name: note.name,
            color: note.color,
            auto_remind: Number(note.auto_remind || 0),  // 是否开启自动提醒
            default_advance_minutes: Number(note.default_advance_minutes || 5)  // 默认提前提醒分钟数
          }))
          console.log('[Store] Electron 加载便签:', notes.value.length)
        }
      }
    } catch (err) {
      console.error('[Store] 加载便签失败:', err)
      // 失败时使用默认便签（使用数字 ID）
      notes.value = [
        { id: 1, name: '工作', color: '#409eff', auto_remind: 0, default_advance_minutes: 5 },
        { id: 2, name: '学习', color: '#67c23a', auto_remind: 0, default_advance_minutes: 5 },
        { id: 3, name: '休息', color: '#e6a23c', auto_remind: 0, default_advance_minutes: 5 },
        { id: 4, name: '运动', color: '#f56c6c', auto_remind: 0, default_advance_minutes: 5 },
        { id: 5, name: '生活', color: '#9254de', auto_remind: 0, default_advance_minutes: 5 },
        { id: 6, name: '其他', color: '#909399', auto_remind: 0, default_advance_minutes: 5 }
      ]
    }
  }

  /**
   * 初始化默认便签（写入数据库）
   */
  async function initDefaultNotes() {
    const defaultNotes = [
      { name: '工作', color: '#409eff' },
      { name: '学习', color: '#67c23a' },
      { name: '休息', color: '#e6a23c' },
      { name: '运动', color: '#f56c6c' },
      { name: '生活', color: '#9254de' },
      { name: '其他', color: '#909399' }
    ]

    try {
      if (platformInfo.isCapacitor && database.isReady()) {
        for (const note of defaultNotes) {
          await database.run(
            'INSERT INTO notes (user_id, name, color) VALUES (1, ?, ?);',
            [note.name, note.color]
          )
        }
        // 重新加载
        const result = await database.query('SELECT * FROM notes WHERE user_id = 1 AND deleted_at IS NULL')
        notes.value = result.map(n => ({
          id: n.id,
          name: n.name,
          color: n.color,
          auto_remind: Number(n.auto_remind || 0),
          default_advance_minutes: Number(n.default_advance_minutes || 5)
        }))
        console.log('[Store] ✅ 初始化默认便签成功:', notes.value.length)
      } else if (isElectron()) {
        for (const note of defaultNotes) {
          await window.electronAPI.createNote(note)
        }
        const result = await window.electronAPI.getAllNotes()
        if (result.success && result.data) {
            notes.value = result.data.map(n => ({
              id: n.id,
              name: n.name,
              color: n.color,
              auto_remind: Number(n.auto_remind || 0),
              default_advance_minutes: Number(n.default_advance_minutes || 5)
            }))
          }
        console.log('[Store] ✅ Electron 初始化默认便签成功:', notes.value.length)
      } else {
        // Web端直接使用默认值（不持久化）
        notes.value = defaultNotes.map((n, i) => ({
          id: i + 1,
          ...n,
          auto_remind: 0,  // Web端默认不开启自动提醒
          default_advance_minutes: 5
        }))
      }
    } catch (err) {
      console.error('[Store] 初始化默认便签失败:', err)
      notes.value = defaultNotes.map((n, i) => ({
        id: i + 1,
        ...n,
        auto_remind: 0,
        default_advance_minutes: 5
      }))
    }
  }

  /**
   * 创建新便签（持久化到数据库）
   */
  async function createNote(noteData) {
    console.log('[Store] createNote:', noteData)

    if (supportsDatabase()) {
      try {
        if (platformInfo.isCapacitor && database.isReady()) {
          const autoRemind = noteData.auto_remind !== undefined ? (noteData.auto_remind ? 1 : 0) : 0
          const defaultAdvanceMinutes = Number.isFinite(noteData.default_advance_minutes)
            ? Math.max(0, noteData.default_advance_minutes)
            : 5
          const result = await database.run(
            'INSERT INTO notes (user_id, name, color, auto_remind, default_advance_minutes) VALUES (1, ?, ?, ?, ?);',
            [noteData.name, noteData.color || '#909399', autoRemind, defaultAdvanceMinutes]
          )
          const newNote = await database.query(
            'SELECT * FROM notes WHERE id = ?;',
            [result.lastInsertRowid]
          )
          if (newNote.length > 0) {
            notes.value.push({
              id: newNote[0].id,
              name: newNote[0].name,
              color: newNote[0].color,
              auto_remind: Number(newNote[0].auto_remind || 0),
              default_advance_minutes: Number(newNote[0].default_advance_minutes || 5)
            })
            console.log('[Store] ✅ Capacitor 创建便签成功:', newNote[0])
            return notes.value[notes.value.length - 1]
          }
        } else if (isElectron()) {
          const result = await window.electronAPI.createNote(noteData)
          if (result.success && result.data) {
            notes.value.push({
              id: result.data.id,
              name: result.data.name,
              color: result.data.color,
              auto_remind: Number(result.data.auto_remind || 0),
              default_advance_minutes: Number(result.data.default_advance_minutes || 5)
            })
            console.log('[Store] ✅ Electron 创建便签成功:', result.data)
            return notes.value[notes.value.length - 1]
          }
        }
      } catch (err) {
        console.error('[Store] 创建便签失败:', err)
      }
    }

    // 不支持数据库时，仅在内存中添加（使用临时ID）
    const tempNote = {
      id: Date.now(),
      name: noteData.name,
      color: noteData.color || '#909399',
      auto_remind: noteData.auto_remind ? 1 : 0,
      default_advance_minutes: Number.isFinite(noteData.default_advance_minutes)
        ? Math.max(0, noteData.default_advance_minutes)
        : 5
    }
    notes.value.push(tempNote)
    return tempNote
  }

  /**
   * 更新便签（持久化到数据库）
   */
  async function updateNote(noteId, updates) {
    console.log('[Store] updateNote:', noteId, updates)
    const idx = notes.value.findIndex(n => n.id === noteId)
    if (idx === -1) return null

    // 标准化自动提醒字段类型
    const normalizedUpdates = { ...updates }
    if (normalizedUpdates.auto_remind !== undefined) {
      normalizedUpdates.auto_remind = normalizedUpdates.auto_remind ? 1 : 0
    }
    if (normalizedUpdates.default_advance_minutes !== undefined) {
      normalizedUpdates.default_advance_minutes = Number(normalizedUpdates.default_advance_minutes) || 5
    }

    if (supportsDatabase()) {
      try {
        if (platformInfo.isCapacitor && database.isReady()) {
          // 构建动态更新SQL,支持所有字段
          const fields = []
          const values = []

          if (normalizedUpdates.name !== undefined) {
            fields.push('name = ?')
            values.push(normalizedUpdates.name)
          }
          if (normalizedUpdates.color !== undefined) {
            fields.push('color = ?')
            values.push(normalizedUpdates.color)
          }
          if (normalizedUpdates.auto_remind !== undefined) {
            fields.push('auto_remind = ?')
            values.push(normalizedUpdates.auto_remind)
          }
          if (normalizedUpdates.default_advance_minutes !== undefined) {
            fields.push('default_advance_minutes = ?')
            values.push(normalizedUpdates.default_advance_minutes)
          }

          if (fields.length > 0) {
            fields.push('updated_at = datetime(\'now\')')
            values.push(noteId)

            await database.run(
              `UPDATE notes SET ${fields.join(', ')} WHERE id = ?;`,
              values
            )
            // ⚠️ 使用数组替换确保触发 Vue 响应式更新（ref 必须感知到数组引用变化）
            notes.value = notes.value.map(n =>
              n.id === noteId ? { ...n, ...normalizedUpdates } : n
            )
            console.log('[Store] ✅ Capacitor 更新便签成功')
            return notes.value.find(n => n.id === noteId)
          }
        } else if (isElectron()) {
          const result = await window.electronAPI.updateNote(noteId, normalizedUpdates)
          if (result.success) {
            // ⚠️ 使用数组替换确保触发 Vue 响应式更新（ref 必须感知到数组引用变化）
            notes.value = notes.value.map(n =>
              n.id === noteId ? { ...n, ...normalizedUpdates } : n
            )
            console.log('[Store] ✅ Electron 更新便签成功')
            return notes.value.find(n => n.id === noteId)
          }
        }
      } catch (err) {
        console.error('[Store] 更新便签失败:', err)
      }
    }

    // 本地更新（fallback）
    notes.value = notes.value.map(n =>
      n.id === noteId ? { ...n, ...normalizedUpdates } : n
    )
    return notes.value.find(n => n.id === noteId)
  }

  /**
   * 删除便签（持久化到数据库）
   */
  async function deleteNote(noteId) {
    console.log('[Store] deleteNote:', noteId)
    const idx = notes.value.findIndex(n => n.id === noteId)
    if (idx === -1) return false

    if (supportsDatabase()) {
      try {
        if (platformInfo.isCapacitor && database.isReady()) {
          // 先将关联时间块的 note_id 置空
          await database.run(
            'UPDATE time_blocks SET note_id = NULL WHERE note_id = ?;',
            [noteId]
          )
          // 软删除便签
          await database.run(
            'UPDATE notes SET deleted_at = datetime(\'now\') WHERE id = ?;',
            [noteId]
          )
          notes.value.splice(idx, 1)
          console.log('[Store] ✅ Capacitor 删除便签成功')
          return true
        } else if (isElectron()) {
          const result = await window.electronAPI.deleteNote(noteId)
          if (result.success) {
            notes.value.splice(idx, 1)
            console.log('[Store] ✅ Electron 删除便签成功')
            return true
          }
        }
      } catch (err) {
        console.error('[Store] 删除便签失败:', err)
      }
    }

    // 本地删除
    notes.value.splice(idx, 1)
    return true
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

              // 1. 如果手动开启提醒，创建提醒
              if (block.enableReminder) {
                try {
                  await createTimeBlockReminder(newBlock, block.advanceMinutes || 5)
                  console.log('[Store] ✅ 手动提醒创建成功')
                } catch (reminderErr) {
                  console.warn('[Store] 创建提醒失败:', reminderErr)
                }
              }

              // 2. 检查便签自动提醒（如果是未来的时间块）
              if (newBlock.noteId && !block.enableReminder) {
                const startTime = dayjs(`${newBlock.date}T${newBlock.startTime}`)
                if (startTime.isAfter(dayjs())) {
                  try {
                    const noteConfig = await database.query(
                      `SELECT auto_remind, default_advance_minutes FROM notes WHERE id = ? AND deleted_at IS NULL;`,
                      [newBlock.noteId]
                    )
                    if (noteConfig.length > 0 && noteConfig[0].auto_remind === 1) {
                      await createTimeBlockReminder(
                        newBlock,
                        noteConfig[0].default_advance_minutes,
                        true, // 自动生成
                        newBlock.noteId
                      )
                      console.log('[Store] ✅ 便签自动提醒创建成功')
                    }
                  } catch (autoErr) {
                    console.warn('[Store] 检查便签自动提醒失败:', autoErr)
                  }
                }
              }

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

            // 1. 如果手动开启提醒，创建提醒
            if (block.enableReminder) {
              try {
                await createTimeBlockReminder(newBlock, block.advanceMinutes || 5)
                console.log('[Store] ✅ 手动提醒创建成功')
              } catch (reminderErr) {
                console.warn('[Store] 创建提醒失败:', reminderErr)
              }
            }

            // 2. 检查便签自动提醒（如果是未来的时间块）
            if (newBlock.noteId && !block.enableReminder) {
              const startTime = dayjs(`${newBlock.date}T${newBlock.startTime}`)
              if (startTime.isAfter(dayjs())) {
                try {
                  const noteInfo = await window.electronAPI.getNoteById(newBlock.noteId)
                  if (noteInfo.success && noteInfo.data && noteInfo.data.auto_remind === 1) {
                    await createTimeBlockReminder(
                      newBlock,
                      noteInfo.data.default_advance_minutes,
                      true, // 自动生成
                      newBlock.noteId
                    )
                    console.log('[Store] ✅ 便签自动提醒创建成功')
                  }
                } catch (autoErr) {
                  console.warn('[Store] 检查便签自动提醒失败:', autoErr)
                }
              }
            }

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

    const oldBlock = blocks.value[idx]
    const oldStart = `${oldBlock.date}T${oldBlock.startTime}:00`

    if (isElectron()) {
      try {
        const dbData = frontendBlockToDb({ ...oldBlock, ...updates })
        const result = await window.electronAPI.updateTimeBlock(id, dbData)
        if (result.success && result.data) {
          const updatedBlock = dbBlockToFrontend(result.data)
          blocks.value[idx] = updatedBlock
          console.log('[Store] 更新时间块:', id)

          // 若开始时间（含日期）发生变化，同步更新关联提醒
          const newStart = `${updatedBlock.date}T${updatedBlock.startTime}:00`
          if (newStart !== oldStart) {
            try {
              await syncReminderAfterTimeBlockUpdate(updatedBlock)
            } catch (reminderErr) {
              console.warn('[Store] 同步提醒失败:', reminderErr)
            }
          }

          return updatedBlock
        }
      } catch (err) {
        console.error('[Store] 更新时间块失败:', err)
      }
    } else if (platformInfo.isCapacitor && database.isReady()) {
      try {
        const merged = { ...oldBlock, ...updates }
        const dbData = frontendBlockToDb(merged)
        const updateSQL = `
          UPDATE time_blocks
          SET note_id = ?, title = ?, description = ?, start_time = ?, end_time = ?, is_completed = ?
          WHERE id = ? AND user_id = 1
        `
        await database.run(updateSQL, [
          dbData.note_id,
          dbData.title,
          dbData.description,
          dbData.start_time,
          dbData.end_time,
          dbData.is_completed,
          id
        ])
        console.log('[Store] Capacitor 更新时间块:', id)

        const updatedBlock = dbBlockToFrontend({ id, ...dbData, note_name: merged.noteName, note_color: merged.noteColor })
        blocks.value[idx] = updatedBlock
        return updatedBlock
      } catch (err) {
        console.error('[Store] Capacitor 更新时间块失败:', err)
      }
    }

    // 非 Electron 环境或失败时，本地更新
    blocks.value[idx] = { ...oldBlock, ...updates }
    return blocks.value[idx]
  }

  /**
   * 删除时间块
   */
  async function deleteBlock(id) {
    pushHistory('删除时间块')

    // 取消关联提醒
    try {
      await cancelTimeBlockReminder(id)
      console.log('[Store] 取消时间块提醒:', id)
    } catch (err) {
      console.warn('[Store] 取消提醒失败:', err)
    }

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
    } else if (platformInfo.isCapacitor && database.isReady()) {
      try {
        await database.run(
          `UPDATE time_blocks SET deleted_at = datetime('now') WHERE id = ?;`,
          [id]
        )
        blocks.value = blocks.value.filter(b => b.id !== id)
        console.log('[Store] ✅ Capacitor 删除时间块:', id)
        return true
      } catch (err) {
        console.error('[Store] Capacitor 删除时间块失败:', err)
      }
    }

    // 非 Electron/Capacitor 环境或失败时，本地删除
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
    // 便签操作（完整 CRUD）
    createNote,
    updateNote,
    deleteNote,
    loadNotesFromDB,
    initDefaultNotes,
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