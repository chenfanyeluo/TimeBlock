/**
 * 日志工具模块
 * 提供统一的日志记录功能，支持不同日志级别和输出目标
 * 在 Electron 主进程中可同时输出到控制台和文件
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 日志级别枚举（数值越大优先级越高）
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// 当前日志级别（可通过 setLevel 调整）
let currentLogLevel = LogLevel.INFO;

// 日志文件路径（延迟初始化）
let logFilePath = null;

/**
 * 设置日志级别
 * @param {number} level - LogLevel 枚举值
 */
function setLevel(level) {
  if (level === undefined || level === null || !(level in LogLevel)) {
    console.warn('[WebDAV-Logger] 无效的日志级别:', level);
    return;
  }
  currentLogLevel = level;
}

/**
 * 设置日志文件路径
 * 启用后将同时输出到文件
 * @param {string} filePath - 日志文件的绝对路径
 */
function setLogFile(filePath) {
  if (!filePath) {
    logFilePath = null;
    return;
  }
  // 确保目录存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logFilePath = filePath;
}

/**
 * 格式化日志输出
 * @param {string} level - 日志级别名称
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 * @returns {string} - 格式化后的日志字符串
 */
function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WebDAV-${level}]`;
  let formatted = `${prefix} ${message}`;
  if (args.length > 0) {
    formatted += ' ' + args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      }
      return JSON.stringify(arg);
    }).join(' ');
  }
  return formatted;
}

/**
 * 核心日志方法
 * @param {number} level - 日志级别数值
 * @param {string} levelName - 日志级别名称
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 */
function log(level, levelName, message, ...args) {
  if (level < currentLogLevel) return;

  const formatted = formatMessage(levelName, message, ...args);

  // 输出到控制台
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    default:
      console.log(formatted);
  }

  // 写入日志文件
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, formatted + '\n', 'utf8');
    } catch (err) {
      console.error(`[WebDAV-Logger] 写入日志文件失败: ${err.message}`);
    }
  }
}

/** @type {(message: string, ...args: any[]) => void} */
const debug = (...args) => log(LogLevel.DEBUG, 'DEBUG', ...args);

/** @type {(message: string, ...args: any[]) => void} */
const info = (...args) => log(LogLevel.INFO, 'INFO', ...args);

/** @type {(message: string, ...args: any[]) => void} */
const warn = (...args) => log(LogLevel.WARN, 'WARN', ...args);

/** @type {(message: string, ...args: any[]) => void} */
const error = (...args) => log(LogLevel.ERROR, 'ERROR', ...args);

module.exports = {
  LogLevel,
  setLevel,
  setLogFile,
  debug,
  info,
  warn,
  error,
};
