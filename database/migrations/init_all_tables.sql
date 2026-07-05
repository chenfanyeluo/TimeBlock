-- ============================================================================
-- Migration: 001 - 创建所有表
-- 日期: 2026-07-04
-- 说明: TimeBlock 云端 MySQL 完整建表脚本
-- 运行: mysql -u root -p < init_all_tables.sql
-- 回滚: 见文件末尾
-- ============================================================================

-- >>> UP <<<

CREATE DATABASE IF NOT EXISTS `time_block`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `time_block`;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT,
  `email`       VARCHAR(255)  NOT NULL,
  `password`    VARCHAR(255)  NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `avatar`      VARCHAR(500)  NULL     DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME      NULL     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_email` (`email`),
  INDEX `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 2. 便签表
CREATE TABLE IF NOT EXISTS `notes` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT        NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `color`       VARCHAR(7)    NOT NULL DEFAULT '#409eff',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME      NULL     DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_deleted` (`deleted_at`),
  CONSTRAINT `fk_note_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='便签表';

-- 3. 时间块表
CREATE TABLE IF NOT EXISTS `time_blocks` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT        NOT NULL,
  `note_id`       BIGINT        NULL     DEFAULT NULL,
  `title`         VARCHAR(200)  NOT NULL,
  `description`   TEXT          NULL     DEFAULT NULL,
  `start_time`    TIMESTAMP     NOT NULL,
  `end_time`      TIMESTAMP     NOT NULL,
  `is_completed`  TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME      NULL     DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_user_note` (`user_id`, `note_id`),
  INDEX `idx_time_range` (`user_id`, `start_time`, `end_time`),
  INDEX `idx_user_date_covering` (`user_id`, `deleted_at`, `start_time`, `end_time`, `note_id`, `title`, `is_completed`),
  FULLTEXT INDEX `ft_title_desc` (`title`, `description`),
  INDEX `idx_deleted` (`deleted_at`),
  CONSTRAINT `fk_timeblock_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_timeblock_note` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='时间块表';

-- 4. 计时器状态表
CREATE TABLE IF NOT EXISTS `active_timers` (
  `user_id`          BIGINT        NOT NULL,
  `time_block_id`    BIGINT        NULL     DEFAULT NULL,
  `title`            VARCHAR(200)  NOT NULL,
  `note_id`        BIGINT        NULL     DEFAULT NULL,
  `started_at`       TIMESTAMP     NOT NULL,
  `elapsed_paused`   INT           NOT NULL DEFAULT 0,
  `is_paused`        TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  INDEX `idx_timer_block` (`time_block_id`),
  CONSTRAINT `fk_timer_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_timer_timeblock` FOREIGN KEY (`time_block_id`) REFERENCES `time_blocks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计时器运行状态表';

-- 5. 同步日志表
CREATE TABLE IF NOT EXISTS `sync_logs` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT        NOT NULL,
  `sync_type`       VARCHAR(20)   NOT NULL DEFAULT 'manual',
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'pending',
  `records_synced`  INT           NOT NULL DEFAULT 0,
  `started_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at`    DATETIME      NULL     DEFAULT NULL,
  `error_message`   TEXT          NULL     DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_sync_logs_user` (`user_id`),
  INDEX `idx_sync_logs_time` (`user_id`, `started_at`),
  CONSTRAINT `fk_synclog_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='同步记录表';

-- 6. 统计汇总表
CREATE TABLE IF NOT EXISTS `statistics` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT        NOT NULL,
  `stat_date`      DATE          NOT NULL,
  `note_id`        BIGINT        NULL     DEFAULT NULL,
  `total_seconds`  INT           NOT NULL DEFAULT 0,
  `block_count`    INT           NOT NULL DEFAULT 0,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_stat_unique` (`user_id`, `stat_date`, `note_id`),
  INDEX `idx_stat_user_date` (`user_id`, `stat_date`),
  CONSTRAINT `fk_stat_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stat_note` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='统计汇总表';

-- ============================================================================
-- >>> DOWN (回滚) <<<
-- 执行前请确认无重要数据！
-- ============================================================================
-- DROP TABLE IF EXISTS `statistics`;
-- DROP TABLE IF EXISTS `sync_logs`;
-- DROP TABLE IF EXISTS `active_timers`;
-- DROP TABLE IF EXISTS `time_blocks`;
-- DROP TABLE IF EXISTS `notes`;
-- DROP TABLE IF EXISTS `users`;
-- DROP DATABASE IF EXISTS `time_block`;
