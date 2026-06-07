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
  INDEX idx_categories_user_id (user_id),
  INDEX idx_categories_sort_order (user_id, sort_order),
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
  INDEX idx_timeblocks_user_id (user_id),
  INDEX idx_timeblocks_category_id (category_id),
  INDEX idx_timeblocks_time_range (user_id, start_time, end_time),
  CONSTRAINT fk_timeblock_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_timeblock_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='时间块表';
