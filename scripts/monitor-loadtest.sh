#!/usr/bin/env bash
# TKOH 压力测试期间 — 内存 / 网络带宽采样
#
# 用法：
#   ./scripts/monitor-loadtest.sh
#   DURATION_SEC=300 INTERVAL_SEC=2 ./scripts/monitor-loadtest.sh
#   IFACE=ens3 ./scripts/monitor-loadtest.sh
#
# 重要：
#   - 业务在 Docker 里，但带宽看的是「宿主机网卡」，不是 docker0。
#   - 压测 BASE_URL=http://127.0.0.1:3200（本机自己打自己）→ 流量在 lo
#   - 从别的电脑打服务器 IP → 流量在 ens3
#   - 本脚本默认同时采 ens3（或 IFACE）和 lo，避免采错网卡一直 0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${REPORT_DIR:-$PROJECT_ROOT/TKHO-backend/scripts/load-test/results}"
DURATION_SEC="${DURATION_SEC:-180}"
INTERVAL_SEC="${INTERVAL_SEC:-2}"
IFACE="${IFACE:-}"
NAME_FILTER="${NAME_FILTER:-tkho-booking}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
CSV="$OUT_DIR/RESOURCE-sample-$STAMP.csv"
MD="$OUT_DIR/RESOURCE-$STAMP.md"

iface_exists() {
  [ -e "/sys/class/net/$1" ]
}

pick_ext_iface() {
  if [ -n "$IFACE" ]; then
    echo "$IFACE"
    return
  fi
  local cand
  for cand in ens3 eth0 enp0s3 eno1; do
    if iface_exists "$cand"; then
      echo "$cand"
      return
    fi
  done
  # /proc/net/dev：接口名在 $1，可能带冒号
  awk '
    NR > 2 {
      name = $1
      sub(/:$/, "", name)
      if (name ~ /^(ens|eth|enp|eno)/) {
        rx = $2 + 0; tx = $10 + 0
        if (rx + tx >= best) { best = rx + tx; pick = name }
      }
    }
    END { if (pick != "") print pick; else print "ens3" }
  ' /proc/net/dev
}

# 正确解析 /proc/net/dev（默认空白分词；$1 为 "ens3:"）
iface_bytes() {
  local ifc="$1"
  awk -v ifc="$ifc" '
    NR > 2 {
      name = $1
      sub(/:$/, "", name)
      if (name == ifc) {
        print $2 + 0, $10 + 0
        exit
      }
    }
  ' /proc/net/dev
}

host_mem() {
  awk '
    /^MemTotal:/ { t = $2 }
    /^MemAvailable:/ { a = $2 }
    END {
      if (t + 0 > 0) print t, (t - a)
      else print 0, 0
    }
  ' /proc/meminfo
}

docker_mem_mb() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "0"
    return
  fi
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' 2>/dev/null \
    | awk -v f="$NAME_FILTER" '
      tolower($0) !~ tolower(f) { next }
      {
        u = $2
        if (u ~ /GiB/) { gsub(/GiB/, "", u); s += u * 1024 }
        else if (u ~ /MiB/) { gsub(/MiB/, "", u); s += u }
        else if (u ~ /KiB/) { gsub(/KiB/, "", u); s += u / 1024 }
      }
      END { printf "%.1f", s + 0 }
    ' || echo "0"
}

fmt_mbps() {
  awk -v b="${1:-0}" 'BEGIN { if (b < 0) b = 0; printf "%.2f", (b * 8) / 1000 / 1000 }'
}

fmt_mib() {
  awk -v kb="${1:-0}" 'BEGIN { printf "%.0f", kb / 1024 }'
}

rate_bps() {
  # prev curr dt → bytes/sec，防回绕
  local prev="$1" curr="$2" dt="$3"
  if [ "$dt" -le 0 ]; then echo 0; return; fi
  if [ "$curr" -lt "$prev" ]; then echo 0; return; fi
  echo $(( (curr - prev) / dt ))
}

EXT_IFACE="$(pick_ext_iface)"
LO_IFACE="lo"

echo "=== TKOH 压测资源采样 ==="
echo "时长 ${DURATION_SEC}s，间隔 ${INTERVAL_SEC}s"
echo "外网网卡: ${EXT_IFACE}（远程压测看这个）"
echo "本机回环: ${LO_IFACE}（BASE_URL=127.0.0.1 时看这个）"
echo "CSV: $CSV"
echo "请在另一终端开始压测；采样期间必须有请求，否则带宽为 0。"
echo ""

echo "ts,elapsed_s,mem_used_mib,mem_total_mib,mem_pct,docker_mem_mib,ext_rx_Mbps,ext_tx_Mbps,lo_rx_Mbps,lo_tx_Mbps" >"$CSV"

read -r ext_rx0 ext_tx0 <<<"$(iface_bytes "$EXT_IFACE")"
read -r lo_rx0 lo_tx0 <<<"$(iface_bytes "$LO_IFACE")"
ext_rx0="${ext_rx0:-0}"; ext_tx0="${ext_tx0:-0}"
lo_rx0="${lo_rx0:-0}"; lo_tx0="${lo_tx0:-0}"
prev_ext_rx="$ext_rx0"; prev_ext_tx="$ext_tx0"
prev_lo_rx="$lo_rx0"; prev_lo_tx="$lo_tx0"

# 启动时打印累计字节，确认能读到网卡
echo "自检 ${EXT_IFACE} 累计 RX/TX 字节: ${ext_rx0} / ${ext_tx0}"
echo "自检 ${LO_IFACE} 累计 RX/TX 字节: ${lo_rx0} / ${lo_tx0}"
if [ "$ext_rx0" = "0" ] && [ "$ext_tx0" = "0" ] && [ "$lo_rx0" = "0" ] && [ "$lo_tx0" = "0" ]; then
  echo "警告: 读不到网卡计数，请检查 /proc/net/dev"
fi
echo ""

start_ts="$(date +%s)"
end_ts=$((start_ts + DURATION_SEC))
n=0

max_mem_pct=0
max_docker=0
max_ext_rx=0
max_ext_tx=0
max_lo_rx=0
max_lo_tx=0
sum_mem_pct=0
sum_docker=0
sum_ext_rx=0
sum_ext_tx=0
sum_lo_rx=0
sum_lo_tx=0

while [ "$(date +%s)" -lt "$end_ts" ]; do
  now="$(date +%s)"
  elapsed=$((now - start_ts))
  sleep "$INTERVAL_SEC" || true

  read -r mem_total_kb mem_used_kb <<<"$(host_mem)"
  mem_total_kb="${mem_total_kb:-0}"
  mem_used_kb="${mem_used_kb:-0}"
  mem_used_mib="$(fmt_mib "$mem_used_kb")"
  mem_total_mib="$(fmt_mib "$mem_total_kb")"
  mem_pct="0"
  if [ "$mem_total_kb" -gt 0 ]; then
    mem_pct="$(awk -v u="$mem_used_kb" -v t="$mem_total_kb" 'BEGIN { printf "%.2f", (u * 100) / t }')"
  fi

  dmem="$(docker_mem_mb)"

  read -r ext_rx1 ext_tx1 <<<"$(iface_bytes "$EXT_IFACE")"
  read -r lo_rx1 lo_tx1 <<<"$(iface_bytes "$LO_IFACE")"
  ext_rx1="${ext_rx1:-0}"; ext_tx1="${ext_tx1:-0}"
  lo_rx1="${lo_rx1:-0}"; lo_tx1="${lo_tx1:-0}"

  dt="$INTERVAL_SEC"
  ext_rx_bps="$(rate_bps "$prev_ext_rx" "$ext_rx1" "$dt")"
  ext_tx_bps="$(rate_bps "$prev_ext_tx" "$ext_tx1" "$dt")"
  lo_rx_bps="$(rate_bps "$prev_lo_rx" "$lo_rx1" "$dt")"
  lo_tx_bps="$(rate_bps "$prev_lo_tx" "$lo_tx1" "$dt")"
  prev_ext_rx="$ext_rx1"; prev_ext_tx="$ext_tx1"
  prev_lo_rx="$lo_rx1"; prev_lo_tx="$lo_tx1"

  ext_rx_mbps="$(fmt_mbps "$ext_rx_bps")"
  ext_tx_mbps="$(fmt_mbps "$ext_tx_bps")"
  lo_rx_mbps="$(fmt_mbps "$lo_rx_bps")"
  lo_tx_mbps="$(fmt_mbps "$lo_tx_bps")"

  ts="$(date '+%Y-%m-%dT%H:%M:%S')"
  echo "$ts,$elapsed,$mem_used_mib,$mem_total_mib,$mem_pct,$dmem,$ext_rx_mbps,$ext_tx_mbps,$lo_rx_mbps,$lo_tx_mbps" >>"$CSV"

  printf "\r[%3ds] RAM %s/%s (%s%%) docker≈%s | %s %s↓/%s↑ | lo %s↓/%s↑ Mbps   " \
    "$elapsed" "$mem_used_mib" "$mem_total_mib" "$mem_pct" "$dmem" \
    "$EXT_IFACE" "$ext_rx_mbps" "$ext_tx_mbps" "$lo_rx_mbps" "$lo_tx_mbps"

  n=$((n + 1))
  sum_mem_pct="$(awk -v a="$sum_mem_pct" -v b="$mem_pct" 'BEGIN { print a + b }')"
  sum_docker="$(awk -v a="$sum_docker" -v b="$dmem" 'BEGIN { print a + b }')"
  sum_ext_rx=$((sum_ext_rx + ext_rx_bps))
  sum_ext_tx=$((sum_ext_tx + ext_tx_bps))
  sum_lo_rx=$((sum_lo_rx + lo_rx_bps))
  sum_lo_tx=$((sum_lo_tx + lo_tx_bps))
  awk -v m="$mem_pct" -v M="$max_mem_pct" 'BEGIN { exit !(m > M) }' && max_mem_pct="$mem_pct"
  awk -v m="$dmem" -v M="$max_docker" 'BEGIN { exit !(m + 0 > M + 0) }' && max_docker="$dmem"
  [ "$ext_rx_bps" -gt "$max_ext_rx" ] && max_ext_rx="$ext_rx_bps"
  [ "$ext_tx_bps" -gt "$max_ext_tx" ] && max_ext_tx="$ext_tx_bps"
  [ "$lo_rx_bps" -gt "$max_lo_rx" ] && max_lo_rx="$lo_rx_bps"
  [ "$lo_tx_bps" -gt "$max_lo_tx" ] && max_lo_tx="$lo_tx_bps"
done

echo ""
echo ""

avg_mem_pct="n/a"
avg_docker="n/a"
avg_ext_rx=0
avg_ext_tx=0
avg_lo_rx=0
avg_lo_tx=0
if [ "$n" -gt 0 ]; then
  avg_mem_pct="$(awk -v s="$sum_mem_pct" -v n="$n" 'BEGIN { printf "%.2f", s / n }')"
  avg_docker="$(awk -v s="$sum_docker" -v n="$n" 'BEGIN { printf "%.1f", s / n }')"
  avg_ext_rx=$((sum_ext_rx / n))
  avg_ext_tx=$((sum_ext_tx / n))
  avg_lo_rx=$((sum_lo_rx / n))
  avg_lo_tx=$((sum_lo_tx / n))
fi

{
  echo "# TKOH 压测资源采样报告"
  echo ""
  echo "| 项目 | 内容 |"
  echo "|------|------|"
  echo "| 采样时间 | $(date -Iseconds) |"
  echo "| 时长 / 间隔 | ${DURATION_SEC}s / ${INTERVAL_SEC}s |"
  echo "| 外网网卡 | ${EXT_IFACE} |"
  echo "| 本机回环 | ${LO_IFACE} |"
  echo "| 样本数 | ${n} |"
  echo "| 明细 CSV | \`$(basename "$CSV")\` |"
  echo ""
  echo "## 内存"
  echo ""
  echo "| 指标 | 值 |"
  echo "|------|-----|"
  echo "| 宿主机平均 / 峰值 | ${avg_mem_pct}% / ${max_mem_pct}% |"
  echo "| tkho 容器内存平均 / 峰值 | ${avg_docker} / ${max_docker} MiB |"
  echo ""
  echo "## 网络"
  echo ""
  echo "| 网卡 | 含义 | 下行平均 | 下行峰值 | 上行平均 | 上行峰值 |"
  echo "|------|------|----------|----------|----------|----------|"
  echo "| ${EXT_IFACE} | 外网／其它机器来压 | $(fmt_mbps "$avg_ext_rx") | $(fmt_mbps "$max_ext_rx") | $(fmt_mbps "$avg_ext_tx") | $(fmt_mbps "$max_ext_tx") |"
  echo "| lo | 本机 127.0.0.1 压测 | $(fmt_mbps "$avg_lo_rx") | $(fmt_mbps "$max_lo_rx") | $(fmt_mbps "$avg_lo_tx") | $(fmt_mbps "$max_lo_tx") |"
  echo ""
  echo "## 说明"
  echo ""
  echo "- 若两边都接近 0：采样期间可能没有压测，或压测尚未开始。"
  echo "- 本机 \`BASE_URL=http://127.0.0.1:3200\` → 看 **lo** 行。"
  echo "- 远程打服务器 IP:3200 → 看 **${EXT_IFACE}** 行。"
  echo "- 不要看 docker0；容器流量进出宿主机时仍会计入 ens3 或 lo。"
  echo ""
} >"$MD"

echo "=== 摘要 ==="
echo "  宿主机 RAM 平均 ${avg_mem_pct}% / 峰值 ${max_mem_pct}%"
echo "  tkho 容器内存 平均 ${avg_docker} MiB / 峰值 ${max_docker} MiB"
echo "  ${EXT_IFACE}  下行 平均 $(fmt_mbps "$avg_ext_rx") / 峰值 $(fmt_mbps "$max_ext_rx") Mbps"
echo "  ${EXT_IFACE}  上行 平均 $(fmt_mbps "$avg_ext_tx") / 峰值 $(fmt_mbps "$max_ext_tx") Mbps"
echo "  lo     下行 平均 $(fmt_mbps "$avg_lo_rx") / 峰值 $(fmt_mbps "$max_lo_rx") Mbps"
echo "  lo     上行 平均 $(fmt_mbps "$avg_lo_tx") / 峰值 $(fmt_mbps "$max_lo_tx") Mbps"
echo ""
if [ "$max_ext_rx" -eq 0 ] && [ "$max_ext_tx" -eq 0 ] && [ "$max_lo_rx" -eq 0 ] && [ "$max_lo_tx" -eq 0 ]; then
  echo "提示: 带宽全程为 0 → 请确认采样同时另一终端正在跑压测。"
  echo "      本机压测请看 lo；远程压测请看 ${EXT_IFACE}。"
fi
echo "报告: $MD"
echo "完成。"
