#!/usr/bin/env bash
# 日曆瀏覽 — 正式 300 VU × 120s
# 用法: source scripts/load-test/env/browse-300.sh && npm run load-test:browse
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

export VUS=300
export DURATION_SEC=120
export POLL_MS=10000
export SYSTEM=both
export USER_COUNT=25
export DAYS=14

echo "[env] browse-300: BASE_URL=$BASE_URL VUS=$VUS DURATION_SEC=$DURATION_SEC SYSTEM=$SYSTEM"
echo "[env] 下一步: npm run load-test:browse"
