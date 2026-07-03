/**
 * 平台适配层 - 统一API入口
 *
 * 自动检测运行平台（Electron/Capacitor/Web）并提供统一API
 * 用于屏蔽不同平台底层实现差异，实现代码复用
 *
 * @module shared/platform
 */

import { Capacitor } from '@capacitor/core'

// 平台检测
export const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined
export const isCapacitor = Capacitor.isNativePlatform()
export const isWeb = !isElectron && !isCapacitor

// 当前平台类型
export const platformType = isElectron ? 'electron' : isCapacitor ? 'capacitor' : 'web'

// 平台信息
export const platformInfo = {
  type: platformType,
  isElectron,
  isCapacitor,
  isWeb,
  isDesktop: isElectron || (isWeb && typeof window !== 'undefined' && window.innerWidth >= 900),
  isMobile: isCapacitor || (isWeb && typeof window !== 'undefined' && window.innerWidth < 900),
  capacitorPlatform: isCapacitor ? Capacitor.getPlatform() : null
}

console.log(`[Platform] 当前平台: ${platformType}`, platformInfo)

// 导出适配器（由各模块实现）
export { database } from './database'
export { storage } from './storage'
export { filesystem } from './filesystem'
export { network } from './network'