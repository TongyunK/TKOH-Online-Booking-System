#!/usr/bin/env bash
# Venue 搶訂 — 冒煙 10 併發（spread）
# 用法: source scripts/load-test/env/venue-smoke.sh && npm run load-test:venue-calendar
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

export CONCURRENCY=10
export USER_COUNT=10
export DAYS=5
export START_DATE="${START_DATE:-2026-09-23}"
export TARGET_MODE=spread
export TIME_SLOTS="${TIME_SLOTS:-09:00-10:00,10:30-11:30,14:00-15:00}"

echo "[env] venue-smoke: BASE_URL=$BASE_URL CONCURRENCY=$CONCURRENCY START_DATE=$START_DATE DAYS=$DAYS TARGET_MODE=$TARGET_MODE"
echo "[env] 搶訂前請先清表；下一步: npm run load-test:venue-calendar"
