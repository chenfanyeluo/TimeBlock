#!/bin/bash
# ============================================================================
# TimeBlock - MySQL 数据库备份脚本
# 用法:
#   bash scripts/db-backup.sh                     # 保存到 backup/ 目录
#   bash scripts/db-backup.sh /path/to/custom      # 指定备份目录
# ============================================================================

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-time_block}"

BACKUP_DIR="${1:-database/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "============================================"
echo "  TimeBlock MySQL 数据库备份"
echo "  源: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "  目标: ${BACKUP_FILE}"
echo "============================================"

mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ 备份完成 (${SIZE})"
  echo "   ${BACKUP_FILE}"
else
  echo "❌ 备份失败"
  exit 1
fi
