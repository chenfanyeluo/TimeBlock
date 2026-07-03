/**
 * 存储适配层
 *
 * 统一封装本地存储API：
 * - Electron/Web: localStorage
 * - Capacitor: @capacitor/preferences
 *
 * @module shared/platform/storage
 */

import { Preferences } from '@capacitor/preferences'
import { isElectron } from './index'

/**
 * 存储适配器
 */
export const storage = {
  /**
   * 获取存储值
   * @param {string} key 键名
   * @returns {Promise<string|null>} 值
   */
  async get(key) {
    if (isElectron) {
      return localStorage.getItem(key)
    } else {
      const { value } = await Preferences.get({ key })
      return value
    }
  },

  /**
   * 设置存储值
   * @param {string} key 键名
   * @param {string} value 值
   * @returns {Promise<void>}
   */
  async set(key, value) {
    if (isElectron) {
      localStorage.setItem(key, value)
    } else {
      await Preferences.set({ key, value })
    }
  },

  /**
   * 删除存储值
   * @param {string} key 键名
   * @returns {Promise<void>}
   */
  async remove(key) {
    if (isElectron) {
      localStorage.removeItem(key)
    } else {
      await Preferences.remove({ key })
    }
  },

  /**
   * 清空所有存储
   * @returns {Promise<void>}
   */
  async clear() {
    if (isElectron) {
      localStorage.clear()
    } else {
      await Preferences.clear()
    }
  },

  /**
   * 获取所有键名
   * @returns {Promise<string[]>}
   */
  async keys() {
    if (isElectron) {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i))
      }
      return keys
    } else {
      const { keys } = await Preferences.keys()
      return keys
    }
  }
}