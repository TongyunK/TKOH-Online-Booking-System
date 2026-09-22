#!/usr/bin/env bash
# TKOH 压力测试期间 — 内存 / 网络带宽采样
#
# 在「被测服务器」上另开一个终端，与压测脚本同时跑：
#   ./scripts/monitor-loadtest.sh                 # 默认采 180 秒，每 2 秒一次
#   DURATION_SEC=300 INTERVAL_SEC=2 ./scripts/monitor-loadtest.sh
#   IFACE=eth0 ./scripts/monitor-loadtest.sh     # 指定网卡；不指定则自动选流量最大的非 lo
#
# 压测结束后看终端摘要，或打开 scripts/load-test/results/RESOURCE-*.md
#
# 依赖：bash、awk；有 docker 则额外采 tkho-booking 容器内存。无需 root（网卡统计读 /proc）。

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

pick_iface() {
  if [ -n "$IFACE" ]; then
    echo "$IFACE"
    return
  fi
  # 优先：主机网卡 ens*/eth*/enp*（外网入口）；不要用 lo / docker0 / br-* / veth*
  local preferred
  preferred="$(awk -F'[: ]+' '
    NR>2 {
      gsub(/^ +/, "", $1);
      name=$1;
      if (name == "lo" || name ~ /^docker/ || name ~ /^br-/ || name ~ /^veth/) next;
      rx=$2+0; tx=$10+0; t=rx+tx;
      score=t;
      if (name ~ /^(ens|eth|enp|eno)/) score=t + 1e15;
      if (score > best) { best=score; pick=name }
    }
    END { if (pick != "") print pick }
  ' /proc/net/dev)"
  if [ -n "$preferred" ]; then
    echo "$preferred"
    return
  fi
  # 兜底：非 lo 累计流量最大
  awk -F'[: ]+' '
    NR>2 {
      gsub(/^ +/, "", $1);
      if ($1 == "lo") next;
      rx=$2+0; tx=$10+0; t=rx+tx;
      if (t > best) { best=t; name=$1 }
    }
    END { if (name != "") print name; else print "ens3" }
  ' /proc/net/dev
}

iface_bytes() {
  local ifc="$1"
  awk -F'[: ]+' -v ifc="$ifc" '
    NR>2 {
      gsub(/^ +/, "", $1);
      if ($1 == ifc) { print $2, $10; exit }
    }
  ' /proc/net/dev
}

host_mem() {
  # 输出: total_kb used_kb（近似：MemTotal - MemAvailable）
  awk '
    /^MemTotal:/ { t=$2 }
    /^MemAvailable:/ { a=$2 }
    END {
      if (t+0 > 0) print t, (t-a);
      else print 0, 0
    }
  ' /proc/meminfo
}

docker_mem_mb() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "0"
    return
  fi
  # 所有名称含 filter 的容器 MemUsage 第一段之和（MiB）
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' 2>/dev/null \
    | awk -v f="$NAME_FILTER" '
      tolower($0) !~ tolower(f) { next }
      {
        # 例: 123.4MiB / 7.7GiB  或 1.2GiB / 7.7GiB
        u=$2;
        if (u ~ /GiB/) { gsub(/GiB/,"",u); s+=u*1024 }
        else if (u ~ /MiB/) { gsub(/MiB/,"",u); s+=u }
        else if (u ~ /KiB/) { gsub(/KiB/,"",u); s+=u/1024 }
      }
      END { printf "%.1f", s+0 }
    ' || echo "0"
}

fmt_mbps() {
  # 参数: bytes_per_sec → Mbps（兆比特/秒，带宽常用）
  awk -v b="$1" 'BEGIN{ printf "%.2f", (b*8)/1000/1000 }'
}

fmt_mib() {
  awk -v kb="$1" 'BEGIN{ printf "%.0f", kb/1024 }'
}

IFACE="$(pick_iface)"
echo "=== TKOH 压测资源采样 ==="
echo "时长 ${DURATION_SEC}s，间隔 ${INTERVAL_SEC}s，网卡 ${IFACE}"
echo "CSV: $CSV"
echo "请在另一终端开始压测；本脚本会采样到结束。"
echo ""

echo "ts,elapsed_s,mem_used_mib,mem_total_mib,mem_pct,docker_mem_mib,rx_Bps,tx_Bps,rx_Mbps,tx_Mbps" >"$CSV"

read -r rx0 tx0 <<<"$(iface_bytes "$IFACE")"
rx0="${rx0:-0}"; tx0="${tx0:-0}"
prev_rx="$rx0"; prev_tx="$tx0"
start_ts="$(date +%s)"
end_ts=$((start_ts + DURATION_SEC))
n=0

max_mem_pct=0
max_docker=0
max_rx_bps=0
max_tx_bps=0
sum_mem_pct=0
sum_docker=0
sum_rx=0
sum_tx=0

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
    mem_pct="$(awk -v u="$mem_used_kb" -v t="$mem_total_kb" 'BEGIN{ printf "%.2f", (u*100)/t }')"
  fi

  dmem="$(docker_mem_mb)"

  read -r rx1 tx1 <<<"$(iface_bytes "$IFACE")"
  rx1="${rx1:-0}"; tx1="${tx1:-0}"
  # 字节/秒（相对上一采样）
  dt="$INTERVAL_SEC"
  rx_bps=$(( (rx1 - prev_rx) / dt ))
  tx_bps=$(( (tx1 - prev_tx) / dt ))
  if [ "$rx_bps" -lt 0 ]; then rx_bps=0; fi
  if [ "$tx_bps" -lt 0 ]; then tx_bps=0; fi
  prev_rx="$rx1"; prev_tx="$tx1"

  rx_mbps="$(fmt_mbps "$rx_bps")"
  tx_mbps="$(fmt_mbps "$tx_bps")"

  ts="$(date '+%Y-%m-%dT%H:%M:%S')"
  echo "$ts,$elapsed,$mem_used_mib,$mem_total_mib,$mem_pct,$dmem,$rx_bps,$tx_bps,$rx_mbps,$tx_mbps" >>"$CSV"
  printf "\r[%3ds] RAM %s/%s MiB (%s%%)  docker≈%s MiB  net %s↓/%s↑ Mbps   " \
    "$elapsed" "$mem_used_mib" "$mem_total_mib" "$mem_pct" "$dmem" "$rx_mbps" "$tx_mbps"

  n=$((n + 1))
  sum_mem_pct="$(awk -v a="$sum_mem_pct" -v b="$mem_pct" 'BEGIN{print a+b}')"
  sum_docker="$(awk -v a="$sum_docker" -v b="$dmem" 'BEGIN{print a+b}')"
  sum_rx=$((sum_rx + rx_bps))
  sum_tx=$((sum_tx + tx_bps))
  awk -v m="$mem_pct" -v M="$max_mem_pct" 'BEGIN{exit !(m>M)}' && max_mem_pct="$mem_pct"
  awk -v m="$dmem" -v M="$max_docker" 'BEGIN{exit !(m+0>M+0)}' && max_docker="$dmem"
  [ "$rx_bps" -gt "$max_rx_bps" ] && max_rx_bps="$rx_bps"
  [ "$tx_bps" -gt "$max_tx_bps" ] && max_tx_bps="$tx_bps"
done

echo ""
echo ""

avg_mem_pct="n/a"
avg_docker="n/a"
avg_rx=0
avg_tx=0
if [ "$n" -gt 0 ]; then
  avg_mem_pct="$(awk -v s="$sum_mem_pct" -v n="$n" 'BEGIN{ printf "%.2f", s/n }')"
  avg_docker="$(awk -v s="$sum_docker" -v n="$n" 'BEGIN{ printf "%.1f", s/n }')"
  avg_rx=$((sum_rx / n))
  avg_tx=$((sum_tx / n))
fi

{
  echo "# TKOH 压测资源采样报告"
  echo ""
  echo "| 项目 | 内容 |"
  echo "|------|------|"
  echo "| 采样时间 | $(date -Iseconds) |"
  echo "| 时长 / 间隔 | ${DURATION_SEC}s / ${INTERVAL_SEC}s |"
  echo "| 网卡 | ${IFACE} |"
  echo "| 样本数 | ${n} |"
  echo "| 明细 CSV | \`$(basename "$CSV")\` |"
  echo ""
  echo "## 内存（宿主机）"
  echo ""
  echo "| 指标 | 值 |"
  echo "|------|-----|"
  echo "| 平均使用率 | ${avg_mem_pct}% |"
  echo "| 峰值使用率 | ${max_mem_pct}% |"
  echo "| 相关容器内存合计（峰值，约） | ${max_docker} MiB |"
  echo "| 相关容器内存合计（平均，约） | ${avg_docker} MiB |"
  echo ""
  echo "## 网络（网卡 ${IFACE}，相对宿主机）"
  echo ""
  echo "| 指标 | 下行 RX | 上行 TX |"
  echo "|------|---------|---------|"
  echo "| 平均 | $(fmt_mbps "$avg_rx") Mbps | $(fmt_mbps "$avg_tx") Mbps |"
  echo "| 峰值 | $(fmt_mbps "$max_rx_bps") Mbps | $(fmt_mbps "$max_tx_bps") Mbps |"
  echo ""
  echo "## 如何阅读"
  echo ""
  echo "- **宿主机 RAM%**：整机内存，含本系统 Docker 与其它进程。"
  echo "- **docker≈MiB**：名称含 \`${NAME_FILTER}\` 的容器当前内存之和（约值）。"
  echo "- **Mbps**：兆比特/秒，带宽常用单位；若要兆字节/秒 ≈ Mbps÷8。"
  echo "- 压测机若在另一台电脑，请在**被测服务器**上跑本脚本才能反映服务端带宽；客户端带宽需在压测机另采。"
  echo ""
} >"$MD"

echo "=== 摘要 ==="
echo "  宿主机 RAM 平均 ${avg_mem_pct}% / 峰值 ${max_mem_pct}%"
echo "  tkho 容器内存 平均 ${avg_docker} MiB / 峰值 ${max_docker} MiB"
echo "  网络 ${IFACE}  下行 平均 $(fmt_mbps "$avg_rx") / 峰值 $(fmt_mbps "$max_rx_bps") Mbps"
echo "  网络 ${IFACE}  上行 平均 $(fmt_mbps "$avg_tx") / 峰值 $(fmt_mbps "$max_tx_bps") Mbps"
echo ""
echo "报告: $MD"
echo "完成。"
