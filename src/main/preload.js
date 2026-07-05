const { contextBridge, ipcRenderer } = require('electron')

/**
 * 暴露安全的 API 到渲染进程
 *
 * 所有数据库操作通过 IPC 通信，确保安全性
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // =============================================
  // 时间块操作
  // =============================================

  /** 获取指定日期的时间块 */
  getTimeBlocksByDate: (date) => ipcRenderer.invoke('timeBlock:getByDate', date),

  /** 获取周视图时间块 */
  getTimeBlocksByWeek: (startDate, endDate) => ipcRenderer.invoke('timeBlock:getByWeek', startDate, endDate),

  /** 获取月视图时间块 */
  getTimeBlocksByMonth: (year, month) => ipcRenderer.invoke('timeBlock:getByMonth', year, month),

  /** 创建时间块 */
  createTimeBlock: (data) => ipcRenderer.invoke('timeBlock:create', data),

  /** 更新时间块 */
  updateTimeBlock: (id, data) => ipcRenderer.invoke('timeBlock:update', id, data),

  /** 删除时间块 */
  deleteTimeBlock: (id) => ipcRenderer.invoke('timeBlock:delete', id),

  // =============================================
  // 便签操作
  // =============================================

  /** 获取所有便签 */
  getAllNotes: () => ipcRenderer.invoke('note:getAll'),

  /** 根据 ID 获取便签 */
  getNoteById: (id) => ipcRenderer.invoke('note:getById', id),

  /** 创建便签 */
  createNote: (data) => ipcRenderer.invoke('note:create', data),

  /** 更新便签 */
  updateNote: (id, data) => ipcRenderer.invoke('note:update', id, data),

  /** 删除便签 */
  deleteNote: (id) => ipcRenderer.invoke('note:delete', id),

  // =============================================
  // 通用数据库操作（保留原有 API）
  // =============================================

  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  dbInsert: (sql, params) => ipcRenderer.invoke('db:insert', sql, params),
  dbUpdate: (sql, params) => ipcRenderer.invoke('db:update', sql, params),
  dbDelete: (sql, params) => ipcRenderer.invoke('db:delete', sql, params),

  // =============================================
  // 系统通知（Electron 原生通知）
  // =============================================

  /** 显示原生系统通知 */
  showNotification: (options) => ipcRenderer.invoke('notification:show', options),

  // =============================================
  // 同步操作（保留原有 API）
  // =============================================

  syncStart: () => ipcRenderer.invoke('sync:start'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),

  // =============================================
  // 认证操作（保留原有 API）
  // =============================================

  authLogin: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authGetUser: () => ipcRenderer.invoke('auth:getUser')
})