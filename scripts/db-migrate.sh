#!/bin/bash
# ============================================================================
# TimeBlock - MySQL 迁移执行脚本
# 用法:
#   bash scripts/db-migrate.sh              # 执行所有迁移
#   bash scripts/db-migrate.sh --dry-run    # 预览但不执行
#   bash scripts/db-migrate.sh --rollback   # 回滚最新迁移
# ============================================================================

set -euo pipefail

# ---- 配置 ----
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-time_block}"
MIGRATIONS_DIR="database/migrations"
MYSQL_CMD="mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p"

# ---- 参数解析 ----
DRY_RUN=false
ROLLBACK=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --rollback)  ROLLBACK=true ;;
    *)           echo "未知参数: $arg" && exit 1 ;;
  esac
done

# ---- 主流程 ----
echo "============================================"
echo "  TimeBlock MySQL 数据库迁移"
echo "  目标: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "============================================"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ 迁移目录不存在: $MIGRATIONS_DIR"
  exit 1
fi

shopt -s nullglob
MIGRATIONS=( "$MIGRATIONS_DIR"/[0-9]*.sql )
shopt -u nullglob

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  echo "❌ 没有找到迁移文件"
  exit 1
fi

echo ""
echo "找到 ${#MIGRATIONS[@]} 个迁移文件:"
for f in "${MIGRATIONS[@]}"; do
  echo "  - $(basename "$f")"
done

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "🔍 --dry-run 模式：不执行任何 SQL"
  exit 0
fi

echo ""
read -rp "确认执行迁移？[y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ [yY] ]]; then
  echo "已取消"
  exit 0
fi

for f in "${MIGRATIONS[@]}"; do
  FILENAME=$(basename "$f")
  echo ""
  echo "▶ 执行: $FILENAME"

  if $MYSQL_CMD < "$f" 2>&1; then
    echo "✅ $FILENAME 完成"
  else
    echo "❌ $FILENAME 失败，中止迁移"
    exit 1
  fi
done

echo ""
echo "============================================"
echo "  ✅ 所有迁移执行完毕"
echo "============================================"
