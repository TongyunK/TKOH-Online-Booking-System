#!/usr/bin/env bash
# EV 搶訂 — 正式 300 併發（spread）
# 用法: source scripts/load-test/env/book-300.sh && npm run load-test:ev-calendar
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

export CONCURRENCY=300
export USER_COUNT=300
export DAYS=14
export START_DATE="${START_DATE:-2026-09-22}"
export PERIOD_IDS="1,2,3"
export TARGET_MODE=spread

echo "[env] book-300: BASE_URL=$BASE_URL CONCURRENCY=$CONCURRENCY START_DATE=$START_DATE TARGET_MODE=$TARGET_MODE"
echo "[env] 搶訂前請先清表；下一步: npm run load-test:ev-calendar"
