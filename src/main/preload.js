const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库操作
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  dbInsert: (sql, params) => ipcRenderer.invoke('db:insert', sql, params),
  dbUpdate: (sql, params) => ipcRenderer.invoke('db:update', sql, params),
  dbDelete: (sql, params) => ipcRenderer.invoke('db:delete', sql, params),

  // 同步操作
  syncStart: () => ipcRenderer.invoke('sync:start'),
  syncStatus: (callback) => ipcRenderer.on('sync:status', callback),

  // 认证操作
  authLogin: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authGetUser: () => ipcRenderer.invoke('auth:getUser')
})
