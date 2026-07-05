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
DROP TABLE IF EXISTS `reminders`;
DROP TABLE IF EXISTS `sync_logs`;
DROP TABLE IF EXISTS `statistics`;
DROP TABLE IF EXISTS `time_blocks`;
DROP TABLE IF EXISTS `notes`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `email`       VARCHAR(255)  NOT NULL                COMMENT '邮箱地址 (唯一)',
  `password`    VARCHAR(255)  NOT NULL                COMMENT '加密密码 (bcrypt)',
  `name`        VARCHAR(100)  NOT NULL                COMMENT '用户姓名',
  `avatar`      VARCHAR(500)  NULL     DEFAULT NULL   COMMENT '头像URL',
  `reset_token`       VARCHAR(255)  NULL     DEFAULT NULL   COMMENT '密码重置Token',
  `reset_token_expires` DATETIME      NULL     DEFAULT NULL   COMMENT '重置Token过期时间',
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
-- 3. notes 便签表
-- --------------------------------------------------------------------------
-- 说明: 用户自定义便签（颜色+名称），支持自动提醒配置
-- 新增字段: auto_remind（是否自动提醒）、default_advance_minutes（默认提前分钟数）
-- 外键: user_id -> users(id) ON DELETE CASCADE
CREATE TABLE `notes` (
  `id`                      BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`                 BIGINT        NOT NULL                COMMENT '所属用户ID',
  `name`                    VARCHAR(100)  NOT NULL                COMMENT '便签名称',
  `color`                   VARCHAR(7)    NOT NULL DEFAULT '#409eff' COMMENT '便签颜色 (HEX)',
  `auto_remind`             TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否自动提醒 (0/1)',
  `default_advance_minutes` INT           NOT NULL DEFAULT 5      COMMENT '默认提前提醒分钟数',
  `created_at`              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`              DATETIME      NULL     DEFAULT NULL   COMMENT '删除时间 (NULL=未删除)',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_deleted` (`deleted_at`),
  INDEX `idx_auto_remind` (`auto_remind`),
  CONSTRAINT `fk_note_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='便签表';

-- --------------------------------------------------------------------------
-- 4. time_blocks 时间块表
-- --------------------------------------------------------------------------
-- 说明: 核心业务表，记录用户的时间块数据
-- 索引策略:
--   - idx_user_note: 联合索引，支持按用户+便签查询（租户隔离）
--   - idx_time_range: 时间范围联合索引
--   - idx_user_date_covering: 覆盖索引，日视图高频查询零回表优化
--   - ft_title_desc: 全文索引，支持中文分词搜索（需配置 ngram parser）
-- 外键: user_id -> users(id) ON DELETE CASCADE
--       note_id -> notes(id) ON DELETE SET NULL
CREATE TABLE `time_blocks` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`       BIGINT        NOT NULL                COMMENT '所属用户ID',
  `note_id`       BIGINT        NULL     DEFAULT NULL   COMMENT '便签ID',
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
  INDEX `idx_user_note` (`user_id`, `note_id`),
  INDEX `idx_time_range` (`user_id`, `start_time`, `end_time`),
  INDEX `idx_user_date_covering` (`user_id`, `deleted_at`, `start_time`, `end_time`, `note_id`, `title`, `is_completed`),
  FULLTEXT INDEX `ft_title_desc` (`title`, `description`),
  INDEX `idx_deleted` (`deleted_at`),
  CONSTRAINT `fk_timeblock_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_timeblock_note` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='时间块表';

-- --------------------------------------------------------------------------
-- 5. reminders 提醒通知表
-- --------------------------------------------------------------------------
-- 说明: 存储用户设置的提醒通知，支持时间块级别和便签级别提醒
-- 新增字段: is_auto（是否自动生成）、note_id（关联便签，用于自动提醒）
-- 设计要点:
--   - target_type: 提醒目标类型（time_block 或 note）
--   - target_id: 关联的时间块ID或便签ID
--   - is_auto: 是否由便签自动提醒功能生成
--   - status: 提醒状态（pending/triggered/dismissed/cancelled）
--   - advance_minutes: 提前提醒分钟数
CREATE TABLE `reminders` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`         BIGINT        NOT NULL                COMMENT '所属用户ID',
  `target_type`     VARCHAR(20)   NOT NULL DEFAULT 'time_block' COMMENT '提醒目标类型: time_block/note',
  `target_id`       BIGINT        NOT NULL                COMMENT '目标ID（时间块ID或便签ID）',
  `remind_at`       DATETIME      NOT NULL                COMMENT '提醒触发时间',
  `advance_minutes` INT           NOT NULL DEFAULT 0      COMMENT '提前提醒分钟数',
  `is_auto`         TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否自动生成 (0/1)',
  `note_id`         BIGINT        NULL     DEFAULT NULL   COMMENT '关联便签ID（自动提醒时记录）',
  `title`           VARCHAR(200)  NOT NULL                COMMENT '提醒标题',
  `message`         TEXT          NULL     DEFAULT NULL   COMMENT '提醒消息内容',
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT '状态: pending/triggered/dismissed/cancelled',
  `triggered_at`    DATETIME      NULL     DEFAULT NULL   COMMENT '触发时间',
  `dismissed_at`    DATETIME      NULL     DEFAULT NULL   COMMENT '关闭时间',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_reminder_user` (`user_id`),
  INDEX `idx_reminder_target` (`target_type`, `target_id`),
  INDEX `idx_reminder_status` (`user_id`, `status`, `remind_at`),
  INDEX `idx_reminder_note` (`note_id`),
  INDEX `idx_reminder_auto` (`is_auto`),
  CONSTRAINT `fk_reminder_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reminder_note` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE SET NULL
  -- 注意: target_id 为 polymorphic 字段（time_block/note），不创建外键约束，
  -- 否则 target_type='note' 时无法插入。业务层通过 target_type + target_id 维护逻辑关联。
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='提醒通知表';

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
--       note_id 为 NULL 时表示全天总计
-- 唯一约束: (user_id, stat_date, note_id) 防止重复统计
-- 外键: user_id -> users(id) ON DELETE CASCADE
--       note_id -> notes(id) ON DELETE SET NULL
CREATE TABLE `statistics` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`        BIGINT        NOT NULL                COMMENT '所属用户ID',
  `stat_date`      DATE          NOT NULL                COMMENT '统计日期',
  `note_id`        BIGINT        NULL     DEFAULT NULL   COMMENT '便签ID (NULL=全天总计)',
  `total_seconds`  INT           NOT NULL DEFAULT 0      COMMENT '该便签总秒数',
  `block_count`    INT           NOT NULL DEFAULT 0      COMMENT '时间块数量',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_stat_unique` (`user_id`, `stat_date`, `note_id`),
  INDEX `idx_stat_user_date` (`user_id`, `stat_date`),
  CONSTRAINT `fk_stat_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stat_note` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='统计汇总表';
