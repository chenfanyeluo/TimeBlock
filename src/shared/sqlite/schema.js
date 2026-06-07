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
 *   2. categories      - 分类表
 *   3. time_blocks     - 时间块表
 *   4. active_timers   - 计时器运行状态表
 *   5. sync_logs       - 同步记录表
 *   6. statistics      - 统计汇总表
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
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME NULL DEFAULT NULL
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_email ON users(email);`,
  `CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);`,

  // =============================================
  // 2. categories 分类表
  // =============================================
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#1890ff',
    icon VARCHAR(50) NULL DEFAULT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(user_id, sort_order);`,
  `CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(deleted_at);`,

  // =============================================
  // 3. time_blocks 时间块表
  // =============================================
  `CREATE TABLE IF NOT EXISTS time_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NULL DEFAULT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL DEFAULT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );`,

  // 时间块索引（与 MySQL 设计文档一致）
  `CREATE INDEX IF NOT EXISTS idx_timeblocks_user_id ON time_blocks(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_user_category ON time_blocks(user_id, category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_time_range ON time_blocks(user_id, start_time, end_time);`,

  // 日视图覆盖索引（零回表优化）
  `CREATE INDEX IF NOT EXISTS idx_user_date_covering ON time_blocks(
    user_id, deleted_at, start_time, end_time, category_id, title, is_completed
  );`,

  `CREATE INDEX IF NOT EXISTS idx_timeblocks_deleted ON time_blocks(deleted_at);`,

  // =============================================
  // 4. active_timers 计时器运行状态表
  // 每用户同时仅一个运行中的计时器（PRIMARY KEY = user_id）
  // =============================================
  `CREATE TABLE IF NOT EXISTS active_timers (
    user_id INTEGER NOT NULL PRIMARY KEY,
    time_block_id INTEGER NULL DEFAULT NULL,
    title VARCHAR(200) NOT NULL,
    category_id INTEGER NULL DEFAULT NULL,
    started_at DATETIME NOT NULL,
    elapsed_paused INTEGER NOT NULL DEFAULT 0,
    is_paused INTEGER NOT NULL DEFAULT 0 CHECK(is_paused IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (time_block_id) REFERENCES time_blocks(id) ON DELETE SET NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_timer_block ON active_timers(time_block_id);`,

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
    category_id INTEGER NULL DEFAULT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    block_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    UNIQUE(user_id, stat_date, category_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_stat_user_date ON statistics(user_id, stat_date);`
]

module.exports = SCHEMA_SQL
