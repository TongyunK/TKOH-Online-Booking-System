#!/usr/bin/env bash
# 列出可用環境腳本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat <<EOF
壓測環境腳本（請用 source，勿直接 ./ 執行）：

  cd ~/Documents/TKOH-Online-Booking-System/TKHO-backend

  # 日曆瀏覽
  source scripts/load-test/env/browse-smoke.sh && npm run load-test:browse
  source scripts/load-test/env/browse-300.sh   && npm run load-test:browse
  source scripts/load-test/env/browse-500.sh   && npm run load-test:browse

  # EV 搶訂（多日 spread）— 執行前請清表
  source scripts/load-test/env/book-smoke.sh && npm run load-test:ev-calendar
  source scripts/load-test/env/book-300.sh   && npm run load-test:ev-calendar
  source scripts/load-test/env/book-500.sh   && npm run load-test:ev-calendar

  # EV 單格熱點
  source scripts/load-test/env/book-hot.sh && npm run load-test:ev

覆蓋預設入口範例：
  BASE_URL=http://127.0.0.1:3211 source scripts/load-test/env/browse-smoke.sh

腳本目錄: $SCRIPT_DIR
EOF
