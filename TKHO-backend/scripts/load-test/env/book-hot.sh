#!/usr/bin/env bash
# EV 搶訂 — 單格熱點 100 併發（同一天同一時段）
# 用法: source scripts/load-test/env/book-hot.sh && npm run load-test:ev
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

export CONCURRENCY=100
export USER_COUNT=100
export BOOKING_DATE="${BOOKING_DATE:-2026-09-22}"
export PERIOD_ID=1

echo "[env] book-hot: BASE_URL=$BASE_URL CONCURRENCY=$CONCURRENCY BOOKING_DATE=$BOOKING_DATE PERIOD_ID=$PERIOD_ID"
echo "[env] 搶訂前請先清該日該時段；下一步: npm run load-test:ev"
