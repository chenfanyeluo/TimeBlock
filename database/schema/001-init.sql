-- =============================================
-- TimeBlock 数据库初始化脚本
-- 数据库: time_block
-- 字符集: utf8mb4 / utf8mb4_unicode_ci
-- 引擎: InnoDB
-- =============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS time_block
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE time_block;

-- =============================================
-- 1. users - 用户表
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密',
  name VARCHAR(100) NOT NULL,
  avatar VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- =============================================
-- 2. categories - 分类表
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#1890ff' COMMENT 'HEX 颜色',
  icon VARCHAR(50) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  INDEX idx_sort_order (user_id, sort_order),
  CONSTRAINT fk_category_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分类表';

-- =============================================
-- 3. time_blocks - 时间块表
-- =============================================
CREATE TABLE IF NOT EXISTS time_blocks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  category_id BIGINT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=未完成 1=已完成',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  INDEX idx_category_id (category_id),
  INDEX idx_time_range (user_id, start_time, end_time),
  CONSTRAINT fk_timeblock_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_timeblock_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='时间块表';

-- =============================================
-- 4. webdav_config - WebDAV配置表
-- =============================================
CREATE TABLE IF NOT EXISTS webdav_config (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  server_url VARCHAR(500) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(500) NOT NULL COMMENT 'AES-256 加密',
  last_sync_at DATETIME NULL,
  sync_interval INT NOT NULL DEFAULT 30 COMMENT '同步间隔(分钟)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_id (user_id),
  CONSTRAINT fk_webdav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WebDAV配置表';

-- =============================================
-- 5. sync_history - 同步历史表
-- =============================================
CREATE TABLE IF NOT EXISTS sync_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  sync_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL COMMENT 'pending/in_progress/completed/failed',
  started_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  uploaded INT NOT NULL DEFAULT 0,
  downloaded INT NOT NULL DEFAULT 0,
  conflicts INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  INDEX idx_sync_id (sync_id),
  INDEX idx_created_at (user_id, started_at),
  CONSTRAINT fk_synchistory_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='同步历史表';
