#!/bin/bash
# TKHO Docker 宿主机级备份：PostgreSQL + 上传文件卷
# 用法（在项目根目录，或任意路径调用）：
#   ./scripts/docker-backup.sh
#   KEEP_DAYS=14 BACKUP_ROOT=/var/backups/tkho ./scripts/docker-backup.sh
#
# crontab 示例（每天 02:15；crontab 不展开 ~，请用绝对路径）：
#   15 2 * * * /home/deperp/Documents/TKOH-Online-Booking-System/scripts/docker-backup.sh >> /var/log/tkho-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 可被环境变量覆盖
BACKUP_ROOT="${BACKUP_ROOT:-$PROJECT_ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tkho-booking-postgres}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tkho_uploads_data_volumes}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$BACKUP_ROOT/$STAMP"
LOG_PREFIX="[tkho-backup $(date +%Y-%m-%dT%H:%M:%S)]"

log() { echo "$LOG_PREFIX $*"; }
die() { log "ERROR: $*"; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker 未安装"

if [ -f "$ENV_FILE" ]; then
  DB_NAME="$(grep -E '^[[:space:]]*DB_NAME=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
  DB_USER="$(grep -E '^[[:space:]]*DB_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
fi
DB_NAME="${DB_NAME:-tkho_booking}"
DB_USER="${DB_USER:-tkho}"

docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 \
  || die "找不到容器 $POSTGRES_CONTAINER（请先部署并确保 Postgres 在运行）"

docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1 \
  || die "找不到卷 $UPLOADS_VOLUME"

mkdir -p "$OUT_DIR"
log "备份目录: $OUT_DIR"
log "数据库: $DB_USER@$DB_NAME  容器: $POSTGRES_CONTAINER"
log "上传卷: $UPLOADS_VOLUME  保留天数: $KEEP_DAYS"

# 1) PostgreSQL（自定义格式，便于 pg_restore）
# 写到宿主机，不往容器 /tmp 落文件：postgres 镜像里该目录常只有 root 可写
DUMP_FILE="$OUT_DIR/tkho_booking.dump"
log "导出 PostgreSQL ..."
docker exec "$POSTGRES_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DUMP_FILE"
[ -s "$DUMP_FILE" ] || die "数据库 dump 为空: $DUMP_FILE"

# 2) 上传文件卷
UPLOADS_TGZ="$OUT_DIR/tkho_uploads.tgz"
log "打包上传文件卷 ..."
docker run --rm \
  -v "$UPLOADS_VOLUME:/data:ro" \
  -v "$OUT_DIR:/backup" \
  alpine tar czf /backup/tkho_uploads.tgz -C /data .
[ -s "$UPLOADS_TGZ" ] || die "上传包为空: $UPLOADS_TGZ"

# 3) 备份 .env（含密钥；目录权限请限制为仅管理员可读）
if [ -f "$ENV_FILE" ]; then
  cp -a "$ENV_FILE" "$OUT_DIR/env.backup"
  chmod 600 "$OUT_DIR/env.backup" 2>/dev/null || true
  log "已复制 .env -> env.backup"
else
  log "警告: 未找到 $ENV_FILE，跳过环境变量备份"
fi

# 校验摘要
{
  echo "stamp=$STAMP"
  echo "db_name=$DB_NAME"
  echo "db_user=$DB_USER"
  echo "postgres_container=$POSTGRES_CONTAINER"
  echo "uploads_volume=$UPLOADS_VOLUME"
  ls -lh "$OUT_DIR"
} > "$OUT_DIR/MANIFEST.txt"

# 清理过期备份
log "清理 ${KEEP_DAYS} 天前的备份目录 ..."
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -print -exec rm -rf {} + 2>/dev/null || true

log "完成: $OUT_DIR"
log "  - $(basename "$DUMP_FILE") ($(du -h "$DUMP_FILE" | awk '{print $1}'))"
log "  - $(basename "$UPLOADS_TGZ") ($(du -h "$UPLOADS_TGZ" | awk '{print $1}'))"
