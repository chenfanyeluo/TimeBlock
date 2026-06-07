-- ============================================================================
-- Time Block Recorder - 数据库初始化脚本
-- 数据库: time_block
-- 引擎: MySQL 8.0+
-- 字符集: utf8mb4 / 排序规则: utf8mb4_unicode_ci
-- 文档依据: docs/04-数据库设计文档.md
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. 创建数据库（若不存在）
-- --------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `time_block`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `time_block`;

-- --------------------------------------------------------------------------
-- 2. users 用户表
-- --------------------------------------------------------------------------
-- 说明: 存储用户基本信息，支持软删除（deleted_at）
-- 索引: 主键 id, 唯一索引 email, 软删除索引 deleted_at
DROP TABLE IF EXISTS `active_timers`;
DROP TABLE IF EXISTS `sync_logs`;
DROP TABLE IF EXISTS `statistics`;
DROP TABLE IF EXISTS `time_blocks`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `email`       VARCHAR(255)  NOT NULL                COMMENT '邮箱地址 (唯一)',
  `password`    VARCHAR(255)  NOT NULL                COMMENT '加密密码 (bcrypt)',
  `name`        VARCHAR(100)  NOT NULL                COMMENT '用户姓名',
  `avatar`      VARCHAR(500)  NULL     DEFAULT NULL   COMMENT '头像URL',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME      NULL     DEFAULT NULL   COMMENT '删除时间 (NULL=未删除)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_email` (`email`),
  INDEX `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='用户表';

-- --------------------------------------------------------------------------
-- 3. categories 分类表
-- --------------------------------------------------------------------------
-- 说明: 用户自定义时间块分类，级联删除关联数据
-- 外键: user_id -> users(id) ON DELETE CASCADE
CREATE TABLE `categories` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`     BIGINT        NOT NULL                COMMENT '所属用户ID',
  `name`        VARCHAR(100)  NOT NULL                COMMENT '分类名称',
  `color`       VARCHAR(7)    NOT NULL DEFAULT '#1890ff' COMMENT '分类颜色 (HEX)',
  `icon`        VARCHAR(50)   NULL     DEFAULT NULL   COMMENT '图标名称',
  `sort_order`  INT           NOT NULL DEFAULT 0      COMMENT '排序顺序',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME      NULL     DEFAULT NULL   COMMENT '删除时间 (NULL=未删除)',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_sort_order` (`user_id`, `sort_order`),
  INDEX `idx_deleted` (`deleted_at`),
  CONSTRAINT `fk_category_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='分类表';

-- --------------------------------------------------------------------------
-- 4. time_blocks 时间块表
-- --------------------------------------------------------------------------
-- 说明: 核心业务表，记录用户的时间块数据
-- 索引策略:
--   - idx_user_category: 联合索引，支持按用户+分类查询（租户隔离）
--   - idx_time_range: 时间范围联合索引
--   - idx_user_date_covering: 覆盖索引，日视图高频查询零回表优化
--   - ft_title_desc: 全文索引，支持中文分词搜索（需配置 ngram parser）
-- 外键: user_id -> users(id) ON DELETE CASCADE
--       category_id -> categories(id) ON DELETE SET NULL
CREATE TABLE `time_blocks` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`       BIGINT        NOT NULL                COMMENT '所属用户ID',
  `category_id`   BIGINT        NULL     DEFAULT NULL   COMMENT '分类ID',
  `title`         VARCHAR(200)  NOT NULL                COMMENT '时间块标题',
  `description`   TEXT          NULL     DEFAULT NULL   COMMENT '描述/备注',
  `start_time`    TIMESTAMP     NOT NULL                COMMENT '开始时间 (UTC)',
  `end_time`      TIMESTAMP     NOT NULL                COMMENT '结束时间 (UTC)',
  `is_completed`  TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否完成 (0/1)',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME      NULL     DEFAULT NULL   COMMENT '删除时间 (NULL=未删除)',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_user_category` (`user_id`, `category_id`),
  INDEX `idx_time_range` (`user_id`, `start_time`, `end_time`),
  INDEX `idx_user_date_covering` (`user_id`, `deleted_at`, `start_time`, `end_time`, `category_id`, `title`, `is_completed`),
  FULLTEXT INDEX `ft_title_desc` (`title`, `description`),
  INDEX `idx_deleted` (`deleted_at`),
  CONSTRAINT `fk_timeblock_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_timeblock_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='时间块表';

-- --------------------------------------------------------------------------
-- 5. active_timers 计时器运行状态表
-- --------------------------------------------------------------------------
-- 说明: 记录用户当前正在运行的计时器，每用户同时仅一个运行中的计时器
-- 设计要点:
--   - PRIMARY KEY = user_id，保证每用户唯一一条运行中计时器
--   - time_block_id 可为 NULL：启动时不立即关联 time_blocks，停止时才写入
--   - elapsed_paused + is_paused：支持暂停/恢复功能
-- 使用流程: 开始计时 -> INSERT | 暂停 -> UPDATE is_paused | 恢复 -> UPDATE is_paused
--           停止计时 -> 写入 time_blocks + DELETE active_timers
CREATE TABLE `active_timers` (
  `user_id`          BIGINT        NOT NULL                COMMENT '所属用户ID（主键，每用户唯一）',
  `time_block_id`    BIGINT        NULL     DEFAULT NULL   COMMENT '关联的时间块ID（停止后回写）',
  `title`            VARCHAR(200)  NOT NULL                COMMENT '计时器标题',
  `category_id`      BIGINT        NULL     DEFAULT NULL   COMMENT '分类ID',
  `started_at`       TIMESTAMP     NOT NULL                COMMENT '计时器启动时间 (UTC)',
  `elapsed_paused`   INT           NOT NULL DEFAULT 0      COMMENT '累计暂停时长（秒），支持暂停/恢复',
  `is_paused`        TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否处于暂停状态 (0/1)',
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`user_id`),
  INDEX `idx_timer_block` (`time_block_id`),
  CONSTRAINT `fk_timer_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_timer_timeblock` FOREIGN KEY (`time_block_id`) REFERENCES `time_blocks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='计时器运行状态表';

-- --------------------------------------------------------------------------
-- 6. sync_logs 同步记录表
-- --------------------------------------------------------------------------
-- 说明: 记录每次 SQLite <-> MySQL 数据同步操作的详细信息
-- 外键: user_id -> users(id) ON DELETE CASCADE
CREATE TABLE `sync_logs` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`         BIGINT        NOT NULL                COMMENT '所属用户ID',
  `sync_type`       VARCHAR(20)   NOT NULL DEFAULT 'manual' COMMENT '同步类型: manual/auto',
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态: pending/in_progress/completed/failed',
  `records_synced`  INT           NOT NULL DEFAULT 0      COMMENT '同步记录数',
  `started_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `completed_at`    DATETIME      NULL     DEFAULT NULL   COMMENT '完成时间',
  `error_message`   TEXT          NULL     DEFAULT NULL   COMMENT '错误信息',
  PRIMARY KEY (`id`),
  INDEX `idx_sync_logs_user` (`user_id`),
  INDEX `idx_sync_logs_time` (`user_id`, `started_at`),
  CONSTRAINT `fk_synclog_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='同步记录表';

-- --------------------------------------------------------------------------
-- 7. statistics 统计汇总表
-- --------------------------------------------------------------------------
-- 说明: 预计算的日统计数据，提高报表查询效率
--       category_id 为 NULL 时表示全天总计
-- 唯一约束: (user_id, stat_date, category_id) 防止重复统计
-- 外键: user_id -> users(id) ON DELETE CASCADE
--       category_id -> categories(id) ON DELETE SET NULL
CREATE TABLE `statistics` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`        BIGINT        NOT NULL                COMMENT '所属用户ID',
  `stat_date`      DATE          NOT NULL                COMMENT '统计日期',
  `category_id`    BIGINT        NULL     DEFAULT NULL   COMMENT '分类ID (NULL=全天总计)',
  `total_seconds`  INT           NOT NULL DEFAULT 0      COMMENT '该分类总秒数',
  `block_count`    INT           NOT NULL DEFAULT 0      COMMENT '时间块数量',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_stat_unique` (`user_id`, `stat_date`, `category_id`),
  INDEX `idx_stat_user_date` (`user_id`, `stat_date`),
  CONSTRAINT `fk_stat_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stat_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='统计汇总表';
