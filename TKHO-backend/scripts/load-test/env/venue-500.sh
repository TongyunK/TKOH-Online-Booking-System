#!/usr/bin/env bash
# Venue 搶訂 — 500 併發（spread）
# 用法: source scripts/load-test/env/venue-500.sh && npm run load-test:venue-calendar
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

export CONCURRENCY=500
export USER_COUNT=500
export DAYS=7
export START_DATE="${START_DATE:-2026-09-23}"
export TARGET_MODE=spread
# 強制寫入本場景默認（勿用 ${TIME_SLOTS:-…}，否則會沿用舊 shell 裡的 4 段）
export TIME_SLOTS="09:00-09:45,10:00-10:45,11:00-11:45,12:00-12:45,13:00-13:45,14:00-14:45,15:00-15:45,16:00-16:45,17:00-17:45,18:00-18:45"

echo "[env] venue-500: BASE_URL=$BASE_URL CONCURRENCY=$CONCURRENCY START_DATE=$START_DATE DAYS=$DAYS TARGET_MODE=$TARGET_MODE"
echo "[env] TIME_SLOTS count=$(echo "$TIME_SLOTS" | tr ',' '\n' | grep -c .) → 理論上限≈7×7×10=490"
echo "[env] 搶訂前請先清表；下一步: npm run load-test:venue-calendar"
