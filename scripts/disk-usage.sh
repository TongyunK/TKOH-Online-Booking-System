#!/usr/bin/env bash
# TKOH 在线预订系统 — 磁盘占用统计（Linux）
#
# 统计：项目目录、本系统相关 Docker 镜像／卷／容器、可选备份目录；
# 并给出相对所在文件系统容量的占比。
#
# 用法（在 Linux 部署机上）：
#   ./scripts/disk-usage.sh
#   ./scripts/disk-usage.sh /home/xxx/Documents/TKOH-Online-Booking-System
#   INCLUDE_BACKUP=0 ./scripts/disk-usage.sh          # 不计 backups/
#   HUMAN=0 ./scripts/disk-usage.sh                   # 一律用 MiB 数字，便于脚本解析
#
# 说明：Docker 镜像可能被其他项目共用；本脚本只统计名称含 tkho-booking 的镜像／卷／容器。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${1:-$SCRIPT_DIR/..}" && pwd)"
INCLUDE_BACKUP="${INCLUDE_BACKUP:-1}"
HUMAN="${HUMAN:-1}"

# 与 compose 一致的命名
VOLUME_NAMES=(
  tkho_postgres_data_volumes
  tkho_redis_data_volumes
  tkho_uploads_data_volumes
)
NAME_FILTER='tkho-booking'

bytes_to_human() {
  local b="${1:-0}"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --suffix=B "$b" 2>/dev/null || echo "${b}B"
  else
    awk -v b="$b" 'BEGIN{
      split("B KiB MiB GiB TiB", u, " ");
      i=1; while (b>=1024 && i<5) { b/=1024; i++ }
      printf (i==1?"%d %s":"%.2f %s"), b, u[i]
    }'
  fi
}

fmt_size() {
  local b="${1:-0}"
  if [ "$HUMAN" = "1" ]; then
    bytes_to_human "$b"
  else
    # MiB 整数，便于对比
    awk -v b="$b" 'BEGIN{ printf "%.0f MiB", b/1024/1024 }'
  fi
}

# 目录占用（字节）；不存在则 0
dir_bytes() {
  local p="$1"
  if [ -d "$p" ]; then
    # -sb 部分系统无 --bytes；用 -sk * 1024 更通用
    local kib
    kib="$(du -sk "$p" 2>/dev/null | awk '{print $1}')"
    echo $((kib * 1024))
  else
    echo 0
  fi
}

# Docker 卷占用（字节）
volume_bytes() {
  local name="$1"
  if ! command -v docker >/dev/null 2>&1; then
    echo 0
    return
  fi
  if ! docker volume inspect "$name" >/dev/null 2>&1; then
    echo 0
    return
  fi
  # 通过 alpine 挂载统计；失败则 0
  local out
  out="$(docker run --rm -v "${name}:/v:ro" alpine:3.20 du -sk /v 2>/dev/null | awk '{print $1}')" || out=0
  echo $(( ${out:-0} * 1024 ))
}

# 匹配名称的镜像总大小（docker images 的 SIZE 为可读格式，改用 docker system df -v 或 inspect）
images_bytes() {
  if ! command -v docker >/dev/null 2>&1; then
    echo 0
    return
  fi
  # 列出 ID，对每个取 VirtualSize / Size
  local ids total=0 sz
  ids="$(docker images --format '{{.ID}} {{.Repository}}:{{.Tag}}' 2>/dev/null | awk -v f="$NAME_FILTER" 'tolower($0) ~ tolower(f) {print $1}' | sort -u)" || ids=""
  if [ -z "$ids" ]; then
    echo 0
    return
  fi
  while read -r id; do
    [ -z "$id" ] && continue
    sz="$(docker image inspect "$id" --format '{{.Size}}' 2>/dev/null || echo 0)"
    total=$((total + ${sz:-0}))
  done <<<"$ids"
  echo "$total"
}

containers_writable_bytes() {
  if ! command -v docker >/dev/null 2>&1; then
    echo 0
    return
  fi
  local names total=0 sz
  names="$(docker ps -a --format '{{.Names}}' 2>/dev/null | awk -v f="$NAME_FILTER" 'tolower($0) ~ tolower(f)')" || names=""
  if [ -z "$names" ]; then
    echo 0
    return
  fi
  while read -r n; do
    [ -z "$n" ] && continue
    # SizeRw = 可写层；SizeRootFs 含镜像，避免与镜像重复计算，只用 SizeRw
    sz="$(docker inspect "$n" --format '{{.SizeRw}}' 2>/dev/null || echo 0)"
    # 部分引擎无 SizeRw，返回空
    sz="${sz:-0}"
    [[ "$sz" =~ ^[0-9]+$ ]] || sz=0
    total=$((total + sz))
  done <<<"$names"
  echo "$total"
}

pct() {
  local part="$1" whole="$2"
  if [ "${whole:-0}" -le 0 ]; then
    echo "n/a"
    return
  fi
  awk -v p="$part" -v w="$whole" 'BEGIN{ printf "%.2f%%", (p*100)/w }'
}

echo "=== TKOH 磁盘占用统计 ==="
echo "时间:        $(date '+%Y-%m-%d %H:%M:%S %z')"
echo "项目目录:    $PROJECT_ROOT"
echo ""

# ---------- 项目目录 ----------
code_bytes="$(dir_bytes "$PROJECT_ROOT")"
# 若计入备份，下面会单独列 backups；为避免「项目目录」含 backups 重复，拆开统计
backup_dir="$PROJECT_ROOT/backups"
backup_bytes=0
project_without_backup="$code_bytes"

if [ -d "$backup_dir" ]; then
  backup_bytes="$(dir_bytes "$backup_dir")"
  # 从项目总占用中减去 backups，得到「代码与其它文件」近似值
  if [ "$code_bytes" -ge "$backup_bytes" ]; then
    project_without_backup=$((code_bytes - backup_bytes))
  fi
fi

echo "--- 1. 项目目录（宿主机文件）---"
echo "  代码与配置等（不含 backups/）:  $(fmt_size "$project_without_backup")"
if [ "$INCLUDE_BACKUP" = "1" ]; then
  echo "  backups/ 备份目录:              $(fmt_size "$backup_bytes")"
else
  echo "  backups/ 备份目录:              $(fmt_size "$backup_bytes")  （INCLUDE_BACKUP=0，不计入合计）"
fi

# ---------- Docker ----------
echo ""
echo "--- 2. Docker（名称含 ${NAME_FILTER}）---"

have_docker=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  have_docker=1
else
  echo "  （Docker 不可用，跳过镜像／卷／容器）"
fi

img_bytes=0
vol_total=0
ctr_bytes=0

if [ "$have_docker" = "1" ]; then
  img_bytes="$(images_bytes)"
  echo "  相关镜像合计:                   $(fmt_size "$img_bytes")"

  echo "  数据卷:"
  for vn in "${VOLUME_NAMES[@]}"; do
    vb="$(volume_bytes "$vn")"
    vol_total=$((vol_total + vb))
    if docker volume inspect "$vn" >/dev/null 2>&1; then
      echo "    - $vn:  $(fmt_size "$vb")"
    else
      echo "    - $vn:  （不存在）"
    fi
  done
  echo "  数据卷合计:                     $(fmt_size "$vol_total")"

  ctr_bytes="$(containers_writable_bytes)"
  echo "  相关容器可写层合计:             $(fmt_size "$ctr_bytes")"
fi

# ---------- 合计 ----------
total=$project_without_backup
if [ "$INCLUDE_BACKUP" = "1" ]; then
  total=$((total + backup_bytes))
fi
total=$((total + img_bytes + vol_total + ctr_bytes))

echo ""
echo "--- 3. 本系统合计（估算）---"
echo "  合计占用:                       $(fmt_size "$total")"
echo "  （= 项目文件 $([ "$INCLUDE_BACKUP" = "1" ] && echo "+ backups") + Docker 镜像 + 数据卷 + 容器可写层）"
echo "  注意: 镜像层可能与其它容器共享，合计可能略有重复或低估，以本表分项为准。"

# ---------- 文件系统占比 ----------
echo ""
echo "--- 4. 相对磁盘／分区的占比 ---"

# 注意：不要用 df -BP —— GNU df 会把 -B P 当成「以 PB 为块大小」，触发 1P 算术错误。
# 使用 POSIX + 1K 块：df -Pk
read_df() {
  local path="$1"
  # 输出: total_kib used_kib mount
  df -Pk "$path" 2>/dev/null | tail -1 | awk '{
    if ($2 ~ /^[0-9]+$/ && $3 ~ /^[0-9]+$/) {
      print $2, $3, $6
    } else {
      print "0", "0", "?"
    }
  }'
}

read -r fs_total_kib fs_used_kib fs_mount <<<"$(read_df "$PROJECT_ROOT")"
fs_total_kib="${fs_total_kib:-0}"
fs_used_kib="${fs_used_kib:-0}"
fs_mount="${fs_mount:-?}"

if [[ "$fs_total_kib" =~ ^[0-9]+$ ]] && [ "$fs_total_kib" -gt 0 ]; then
  fs_total_bytes=$((fs_total_kib * 1024))
  fs_used_bytes=$((fs_used_kib * 1024))
  fs_free_bytes=$((fs_total_bytes - fs_used_bytes))
  if [ "$fs_free_bytes" -lt 0 ]; then fs_free_bytes=0; fi

  echo "  项目所在分区挂载点:             $fs_mount"
  echo ""
  echo "  【整盘有多大、已经用了多少】（与本系统无关，是整台机在该分区上的情况）"
  echo "    分区总容量 A:                 $(fmt_size "$fs_total_bytes")"
  echo "    分区已用 B（所有文件合计）:   $(fmt_size "$fs_used_bytes")"
  echo "    分区剩余:                     $(fmt_size "$fs_free_bytes")"
  echo "    → 整盘使用率 = B ÷ A = $(pct "$fs_used_bytes" "$fs_total_bytes")"
  echo "      （例：9.5GB ÷ 193GB ≈ 4.9%，表示整盘才用了不到 5%）"
  echo ""
  echo "  【本系统占多大】（第三节合计，记为 C = $(fmt_size "$total")）"
  echo "    占分区总容量 = C ÷ A = $(pct "$total" "$fs_total_bytes")"
  echo "      → 在整块 ${fs_mount} 盘里，本系统约占 $(pct "$total" "$fs_total_bytes")"
  echo "      （例：2.9GB ÷ 193GB ≈ 1.5%，盘还很空，本系统只占很小一块）"
  echo ""
  echo "    占「当前已用空间」 = C ÷ B = $(pct "$total" "$fs_used_bytes")"
  echo "      → 在已经用掉的那些空间里，有约 $(pct "$total" "$fs_used_bytes") 是本系统"
  echo "      （例：2.9GB ÷ 9.5GB ≈ 30%，说明该盘已用空间里约三成是本系统，其余是系统／其它软件）"
  echo ""
  echo "  一句话对照："
  echo "    · $(pct "$fs_used_bytes" "$fs_total_bytes") = 整盘满了多少（大家共用）"
  echo "    · $(pct "$total" "$fs_total_bytes") = 本系统相对整盘有多大"
  echo "    · $(pct "$total" "$fs_used_bytes") = 本系统在「已用空间」里占多大比重"

  read -r root_total_kib _root_used root_mount <<<"$(read_df /)"
  root_mount="${root_mount:-/}"
  if [ "$root_mount" != "$fs_mount" ] && [[ "${root_total_kib:-0}" =~ ^[0-9]+$ ]] && [ "${root_total_kib:-0}" -gt 0 ]; then
    root_total_bytes=$((root_total_kib * 1024))
    echo ""
    echo "  另：根分区 (/) 总容量 $(fmt_size "$root_total_bytes")；本系统占根分区 $(pct "$total" "$root_total_bytes")"
  fi
else
  echo "  （无法解析 df 输出，跳过占比。可手动执行: df -h \"$PROJECT_ROOT\"）"
fi

echo ""
echo "完成。"
