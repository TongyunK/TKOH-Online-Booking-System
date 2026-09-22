#!/usr/bin/env bash
# Venue 搶訂 — 單格熱點（同一房間同一時段）
# 用法: source scripts/load-test/env/venue-hot.sh && npm run load-test:venue
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

export CONCURRENCY=100
export USER_COUNT=100
export BOOKING_DATE="${BOOKING_DATE:-2026-09-23}"
export ROOM_NAME="${ROOM_NAME:-Conference Room 1}"
export START_TIME="${START_TIME:-10:00}"
export END_TIME="${END_TIME:-11:00}"

echo "[env] venue-hot: BASE_URL=$BASE_URL CONCURRENCY=$CONCURRENCY BOOKING_DATE=$BOOKING_DATE ROOM_NAME=$ROOM_NAME $START_TIME-$END_TIME"
echo "[env] 搶訂前請先清該房間該日該時段；下一步: npm run load-test:venue"
