#!/bin/bash
# 从 scripts/docker-backup.sh 生成的目录恢复（覆盖目标库与上传卷）
# 用法：
#   ./scripts/docker-restore.sh backups/20260921_021500
#
# 注意：会覆盖当前 PostgreSQL 数据与 uploads 卷；执行前请确认。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="${1:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tkho-booking-postgres}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tkho_uploads_data_volumes}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "[tkho-restore] $*"; }

[ -n "$BACKUP_DIR" ] || die "用法: $0 <backup-dir>（例如 backups/20260921_021500）"
[ -d "$BACKUP_DIR" ] || die "备份目录不存在: $BACKUP_DIR"
DUMP_FILE="$BACKUP_DIR/tkho_booking.dump"
UPLOADS_TGZ="$BACKUP_DIR/tkho_uploads.tgz"
[ -s "$DUMP_FILE" ] || die "缺少 dump: $DUMP_FILE"
[ -s "$UPLOADS_TGZ" ] || die "缺少上传包: $UPLOADS_TGZ"

command -v docker >/dev/null 2>&1 || die "Docker 未安装"
docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || die "找不到容器 $POSTGRES_CONTAINER"
docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1 || die "找不到卷 $UPLOADS_VOLUME"

if [ -f "$ENV_FILE" ]; then
  DB_NAME="$(grep -E '^[[:space:]]*DB_NAME=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
  DB_USER="$(grep -E '^[[:space:]]*DB_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
fi
DB_NAME="${DB_NAME:-tkho_booking}"
DB_USER="${DB_USER:-tkho}"

echo "即将覆盖恢复："
echo "  备份目录: $BACKUP_DIR"
echo "  数据库:   $DB_USER@$DB_NAME ($POSTGRES_CONTAINER)"
echo "  上传卷:   $UPLOADS_VOLUME"
read -r -p "确认继续？输入 yes 继续: " confirm
[ "$confirm" = "yes" ] || die "已取消"

log "恢复 PostgreSQL ..."
REMOTE_DUMP="/var/lib/postgresql/tkho_booking.dump"
docker cp "$DUMP_FILE" "$POSTGRES_CONTAINER:$REMOTE_DUMP"
docker exec -u root "$POSTGRES_CONTAINER" chmod 644 "$REMOTE_DUMP"
docker exec "$POSTGRES_CONTAINER" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "$REMOTE_DUMP" \
  || log "pg_restore 结束（部分 already exists 警告通常可忽略）"
docker exec -u root "$POSTGRES_CONTAINER" rm -f "$REMOTE_DUMP"

log "恢复上传文件卷 ..."
docker run --rm \
  -v "$UPLOADS_VOLUME:/data" \
  -v "$(cd "$BACKUP_DIR" && pwd):/backup:ro" \
  alpine sh -c "rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null; tar xzf /backup/tkho_uploads.tgz -C /data"

log "完成。请刷新站点并检查登录与场地图片。"
log "若 SMTP 等密文异常，请确认 JWT_SECRET 与备份时一致（可用备份目录中的 env.backup）。"
