/**
 * ElMessage 单例封装
 *
 * 全局只保留一个消息提示框，新的提示出现时先关闭旧的，
 * 从而避免多个提示从顶部向下堆叠、占用视觉空间。
 */
import { ElMessage as BaseElMessage } from 'element-plus'

let currentMessage = null

function show(optionsOrMessage, defaultType = 'info') {
  // 关闭已存在的提示框，保证始终只有一个
  if (currentMessage) {
    try {
      currentMessage.close()
    } catch (e) {
      // ignore
    }
    currentMessage = null
  }

  const baseOptions =
    typeof optionsOrMessage === 'string'
      ? { message: optionsOrMessage }
      : { ...optionsOrMessage }

  const options = {
    ...baseOptions,
    type: baseOptions.type || defaultType
  }

  const originalOnClose = options.onClose
  options.onClose = (instance) => {
    if (currentMessage === instance) {
      currentMessage = null
    }
    if (typeof originalOnClose === 'function') {
      originalOnClose(instance)
    }
  }

  currentMessage = BaseElMessage(options)
  return currentMessage
}

function message(options) {
  return show(options)
}

message.success = (options) => show(options, 'success')
message.error = (options) => show(options, 'error')
message.warning = (options) => show(options, 'warning')
message.info = (options) => show(options, 'info')
message.closeAll = () => BaseElMessage.closeAll()

export { message as ElMessage }
