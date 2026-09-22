#!/usr/bin/env bash
# 壓測環境變數腳本（在 TKHO-backend 目錄執行，或任意路徑 source）
#
# 用法（務必用 source，才能讓 export 留在目前終端）：
#   cd ~/Documents/TKOH-Online-Booking-System/TKHO-backend
#   source scripts/load-test/env/browse-smoke.sh
#   npm run load-test:browse
#
#   source scripts/load-test/env/book-300.sh
#   npm run load-test:ev-calendar
#
# 直接執行 ./xxx.sh 不會把變數留在父 shell；請用 source 或 . scripts/load-test/env/xxx.sh

# 若已設定 BASE_URL 則不覆蓋；否則預設本機 Nginx
export BASE_URL="${BASE_URL:-http://127.0.0.1:3200}"
