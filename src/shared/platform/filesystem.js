/**
 * 文件系统适配层
 *
 * 统一封装文件操作API：
 * - Electron: window.electronAPI + Node.js fs
 * - Capacitor: @capacitor/filesystem
 * - Web: Blob + download
 *
 * @module shared/platform/filesystem
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { isElectron, isCapacitor } from './index'

/**
 * 文件系统适配器
 */
export const filesystem = {
  /**
   * 写入文件（用于数据导出）
   * @param {string} filename 文件名
   * @param {string} data 文件内容（JSON字符串）
   * @returns {Promise<{path?: string, success: boolean}>}
   */
  async writeFile(filename, data) {
    try {
      if (isElectron) {
        // Electron: 通过 IPC 调用主进程 fs 模块（需在 preload 中实现）
        // 暂时使用 Web 方式触发下载
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        return { success: true }
      } else if (isCapacitor) {
        // Capacitor: 使用文件系统插件
        const result = await Filesystem.writeFile({
          path: filename,
          data: data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        })
        return { path: result.uri, success: true }
      } else {
        // Web: 触发浏览器下载
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        return { success: true }
      }
    } catch (error) {
      console.error('[FileSystem] 写入文件失败:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * 读取文件
   * @param {string} filename 文件名
   * @returns {Promise<{data?: string, success: boolean}>}
   */
  async readFile(filename) {
    try {
      if (isCapacitor) {
        const result = await Filesystem.readFile({
          path: filename,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        })
        return { data: result.data, success: true }
      } else {
        // Electron/Web 不支持直接读取本地文件（安全限制）
        console.warn('[FileSystem] Web/Electron不支持直接读取本地文件')
        return { success: false, error: 'Not supported on this platform' }
      }
    } catch (error) {
      console.error('[FileSystem] 读取文件失败:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * 删除文件
   * @param {string} filename 文件名
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filename) {
    try {
      if (isCapacitor) {
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Documents
        })
        return { success: true }
      } else {
        console.warn('[FileSystem] Web/Electron不支持直接删除本地文件')
        return { success: false, error: 'Not supported on this platform' }
      }
    } catch (error) {
      console.error('[FileSystem] 删除文件失败:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * 获取文件路径（Capacitor专用）
   * @param {string} filename 文件名
   * @returns {Promise<string>}
   */
  async getFilePath(filename) {
    if (isCapacitor) {
      const result = await Filesystem.getUri({
        path: filename,
        directory: Directory.Documents
      })
      return result.uri
    }
    return null
  }
}