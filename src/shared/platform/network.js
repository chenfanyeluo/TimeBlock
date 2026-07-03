/**
 * 网络状态适配层
 *
 * 统一封装网络状态检测API：
 * - Electron/Web: navigator.onLine
 * - Capacitor: @capacitor/network
 *
 * @module shared/platform/network
 */

import { Network } from '@capacitor/network'
import { isElectron, isCapacitor } from './index'

/**
 * 网络适配器
 */
export const network = {
  /**
   * 获取当前网络状态
   * @returns {Promise<{connected: boolean, connectionType?: string}>}
   */
  async getStatus() {
    if (isElectron || !isCapacitor) {
      return {
        connected: navigator.onLine,
        connectionType: navigator.onLine ? 'unknown' : 'none'
      }
    } else {
      const status = await Network.getStatus()
      return {
        connected: status.connected,
        connectionType: status.connectionType
      }
    }
  },

  /**
   * 监听网络状态变化
   * @param {Function} callback 回调函数，接收状态对象
   * @returns {Promise<void>}
   */
  async listen(callback) {
    if (isElectron || !isCapacitor) {
      // Web/Electron: 使用 window 事件
      window.addEventListener('online', () => callback({ connected: true }))
      window.addEventListener('offline', () => callback({ connected: false }))
    } else {
      // Capacitor: 使用插件监听
      Network.addListener('networkStatusChange', (status) => {
        callback({
          connected: status.connected,
          connectionType: status.connectionType
        })
      })
    }
  },

  /**
   * 移除网络状态监听
   * @returns {Promise<void>}
   */
  async removeAllListeners() {
    if (isCapacitor) {
      await Network.removeAllListeners()
    } else {
      window.removeEventListener('online', () => {})
      window.removeEventListener('offline', () => {})
    }
  }
}