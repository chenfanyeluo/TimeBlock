/**
 * SQLite 建表 Schema 定义
 *
 * 与服务端 MySQL 表结构保持一致，适配 SQLite 语法差异：
 * - AUTO_INCREMENT → AUTOINCREMENT / INTEGER PRIMARY KEY AUTOINCREMENT
 * - BIGINT → INTEGER
 * - TINYINT → INTEGER
 * - TIMESTAMP/DATETIME → TEXT (存储 ISO 格式字符串)
 * - FULLTEXT INDEX → 使用 FTS5 虚拟表或 LIKE 替代
 * - 外键约束语法兼容
 *
 * 共 6 张表:
 *   1. users          - 用户表
 *   2. notes          - 便签表
 *   3. time_blocks    - 时间块表
 *   4. reminders      - 提醒通知表（时间块/便签级别提醒）
 *   5. sync_logs      - 同步记录表
 *   6. statistics     - 统计汇总表
 *
 * @module sqlite/schema
 */

const SCHEMA_SQL = [
  // =============================================
  // 1. users 用户表
  // =============================================
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(500) NULL DEFAULT NULL,
    reset_token VARCHAR(255) NULL DEFAULT NULL,
    reset_token_expires DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME NULL DEFAULT NULL
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_email ON users(email);`,
  `CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);`,

  // =============================================
  // 2. notes 便签表
  // 添加自动提醒配置字段
  // =============================================
  `CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(9) NOT NULL DEFAULT '#409eff',
    auto_remind INTEGER NOT NULL DEFAULT 0 CHECK(auto_remind IN (0, 1)),
    default_advance_minutes INTEGER NOT NULL DEFAULT 5,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);`,
  `CREATE INDEX IF NOT EXISTS idx_notes_auto_remind ON notes(auto_remind);`,

  // =============================================
  // 3. time_blocks 时间块表
  // =============================================
  `CREATE TABLE IF NOT EXISTS time_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    note_id INTEGER NULL DEFAULT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL DEFAULT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
  );`,

  // 时间块索引（与 MySQL 设计文档一致）
  `CREATE INDEX IF NOT EXISTS idx_timeblocks_user_id ON time_blocks(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_user_note ON time_blocks(user_id, note_id);`,
  `CREATE INDEX IF NOT EXISTS idx_time_range ON time_blocks(user_id, start_time, end_time);`,

  // 日视图覆盖索引（零回表优化）
  `CREATE INDEX IF NOT EXISTS idx_user_date_covering ON time_blocks(
    user_id, deleted_at, start_time, end_time, note_id, title, is_completed
  );`,

  `CREATE INDEX IF NOT EXISTS idx_timeblocks_deleted ON time_blocks(deleted_at);`,

  // =============================================
  // 4. reminders 提醒通知表
  // 支持时间块级别提醒和便签级别提醒
  // is_auto: 是否由便签自动提醒功能生成
  // =============================================
  `CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_type VARCHAR(20) NOT NULL DEFAULT 'time_block' CHECK(target_type IN ('time_block', 'note')),
    target_id INTEGER NOT NULL,
    remind_at DATETIME NOT NULL,
    advance_minutes INTEGER NOT NULL DEFAULT 0,
    is_auto INTEGER NOT NULL DEFAULT 0 CHECK(is_auto IN (0, 1)),
    note_id INTEGER NULL DEFAULT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NULL DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'triggered', 'dismissed', 'cancelled')),
    triggered_at DATETIME NULL DEFAULT NULL,
    dismissed_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
    -- target_id 为 polymorphic 字段（time_block/note），不创建外键约束
  );`,

  // 提醒表索引（与 MySQL DDL 对齐）
  `CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_target ON reminders(target_type, target_id);`,
  `CREATE INDEX IF NOT EXISTS idx_reminder_status ON reminders(user_id, status, remind_at);`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_note ON reminders(note_id);`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_auto ON reminders(is_auto);`,

  // =============================================
  // 5. sync_logs 同步记录表
  // =============================================
  `CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sync_type VARCHAR(20) NOT NULL DEFAULT 'manual',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    records_synced INTEGER NOT NULL DEFAULT 0,
    started_at DATETIME NOT NULL DEFAULT (datetime('now')),
    completed_at DATETIME NULL DEFAULT NULL,
    error_message TEXT NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(user_id, started_at);`,

  // =============================================
  // 6. statistics 统计汇总表
  // =============================================
  `CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    note_id INTEGER NULL DEFAULT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    block_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL,
    UNIQUE(user_id, stat_date, note_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_stat_user_date ON statistics(user_id, stat_date);`
]

module.exports = SCHEMA_SQL
