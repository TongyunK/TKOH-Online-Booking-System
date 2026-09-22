# 压测：抢订 + 日历浏览（300–500 用户）

脚本均在 `TKHO-backend` 下用 Node 18+ 运行，**无需额外依赖**。登录字段为 `corpId`（与后端 DTO 一致）。

**服务器逐步操作（含健康检查 / 清表 SQL / 300–500 命令）→ [SERVER-CHECKLIST.md](./SERVER-CHECKLIST.md)**  
**2026-09-21 实测结果总结 → [LOAD-TEST-RESULTS-2026-09-21.md](./LOAD-TEST-RESULTS-2026-09-21.md)**

压测跑完后会**自动**在 `scripts/load-test/results/` 下生成**繁体中文** Markdown（含 `wall_ms` 等参数说明）。  
关闭：`WRITE_REPORT=0`；自定义目录：`REPORT_DIR=/path/to/dir`。

### 快速切换环境变量（推荐）

```bash
cd ~/Documents/TKOH-Online-Booking-System/TKHO-backend

# 查看全部场景
bash scripts/load-test/env/list.sh

# 必须用 source，变量才会留在当前终端
source scripts/load-test/env/browse-smoke.sh && npm run load-test:browse
source scripts/load-test/env/browse-300.sh   && npm run load-test:browse
source scripts/load-test/env/browse-500.sh   && npm run load-test:browse

source scripts/load-test/env/book-smoke.sh && npm run load-test:ev-calendar
source scripts/load-test/env/book-300.sh   && npm run load-test:ev-calendar
source scripts/load-test/env/book-500.sh   && npm run load-test:ev-calendar
source scripts/load-test/env/book-hot.sh   && npm run load-test:ev

source scripts/load-test/env/venue-smoke.sh && npm run load-test:venue-calendar
source scripts/load-test/env/venue-300.sh   && npm run load-test:venue-calendar
source scripts/load-test/env/venue-500.sh   && npm run load-test:venue-calendar
source scripts/load-test/env/venue-hot.sh   && npm run load-test:venue
```

| 命令 | 脚本 | 场景 |
|------|------|------|
| `npm run load-test:ev` | `ev-booking-concurrent.mjs` | **抢订** — EV 单格热点（同一天+时段） |
| `npm run load-test:ev-calendar` | `ev-booking-calendar-stress.mjs` | **抢订** — EV 多日×多时段分散 |
| `npm run load-test:venue` | `venue-booking-concurrent.mjs` | **抢订** — Venue 单格热点（同房间+时段） |
| `npm run load-test:venue-calendar` | `venue-booking-calendar-stress.mjs` | **抢订** — Venue 多日×多房间×多时段 |
| `npm run load-test:browse` | `calendar-browse-stress.mjs` | **日历浏览** — EV / Venue 读接口 |

共用工具：`common.mjs`。

---

## 前置条件

1. PostgreSQL、**Redis** 已启动，并已迁移：
   ```powershell
   cd TKHO-backend
   npx prisma migrate deploy
   npm run prisma:seed
   ```
2. 后端已启动，或 Docker 经 Nginx 入口：
   - 本地 dev：`http://127.0.0.1:3210`
   - Docker Nginx：`http://127.0.0.1:3200`（或服务器 IP:3200）
3. EV 抢订：Admin 已发布 **Booking Date Range** 覆盖测试日期。
4. 抢订高压前提高限流（默认约 30 次/用户/分钟）：
   ```powershell
   $env:EV_BOOKING_RATE_LIMIT_PER_MIN = "500"
   ```
   （写在启动后端的环境 / `.env` / compose 中，然后重启后端生效。）

### Seed 规模说明

默认 seed：**约 25 用户**（E002–E025）、**3 个 EV 车位**。  
`VUS`/`CONCURRENCY` 大于 25 时会**循环复用**账号（浏览场景可接受；抢订需提高限流，并注意周限额）。

---

## A. 日历浏览（推荐先测）

模拟前端：约每 10s 拉 EV 可用性，约每 60s 拉 booking-window；Venue 拉 rooms + week bookings。

### 冒烟（30 VU × 30s）

```powershell
cd TKHO-backend
$env:BASE_URL = "http://127.0.0.1:3200"
$env:VUS = "30"
$env:DURATION_SEC = "30"
$env:POLL_MS = "10000"
$env:SYSTEM = "both"
npm run load-test:browse
```

### 目标规模 300–500

```powershell
$env:BASE_URL = "http://127.0.0.1:3200"
$env:VUS = "300"          # 或 500
$env:DURATION_SEC = "120"
$env:POLL_MS = "10000"
$env:SYSTEM = "both"      # parking | room | both
npm run load-test:browse
```

| 变量 | 说明 | 默认 |
|------|------|------|
| `VUS` | 同时在线虚拟用户 | 300 |
| `DURATION_SEC` | 持续秒数 | 120 |
| `POLL_MS` | 每轮间隔（对齐 EV 日历 ~10s） | 10000 |
| `SYSTEM` | `parking` / `room` / `both` | both |
| `DAYS` | EV 日历窗口天数 | 14 |

**通过标准（建议）**：`fail≈0`；各接口 p95 可接受（常见目标 &lt; 2–3s）；无大量 5xx。

---

## B. 抢订 — 日历级分散（推荐做 300–500 写压测）

`TARGET_MODE=spread`：请求均匀打到多日×多时段，避免全挤在一格只成功 3 笔。

### 准备

1. 发布 Booking Date Range  
2. 清表（按你的 `START_DATE` / `DAYS` 改）：

```sql
DELETE FROM ev_bookings
WHERE booking_date >= DATE '2026-05-21'
  AND booking_date <= DATE '2026-06-03'
  AND period_id IN (1, 2, 3);
```

### 100 → 300/500

```powershell
cd TKHO-backend
$env:BASE_URL = "http://127.0.0.1:3200"
$env:CONCURRENCY = "300"   # 或 500
$env:USER_COUNT = "300"
$env:DAYS = "14"
$env:START_DATE = "2026-05-21"
$env:PERIOD_IDS = "1,2,3"
$env:TARGET_MODE = "spread"
npm run load-test:ev-calendar
```

| TARGET_MODE | 说明 |
|-------------|------|
| `spread` | 均匀分布到各日×时段（推荐） |
| `hot` | 全部打同一格（测抢 3 车位） |
| `random` | 随机格 |

**通过标准**：`duplicateSlot = 0`；`success` ≤ 容量；下方 SQL 无重复行。

```sql
SELECT slot_id, period_id, booking_date, COUNT(*) AS cnt
FROM ev_bookings
WHERE status IN ('pending', 'confirmed')
  AND booking_date BETWEEN DATE '2026-05-21' AND DATE '2026-06-03'
GROUP BY slot_id, period_id, booking_date
HAVING COUNT(*) > 1;
```

---

## C. 抢订 — 单格热点

多人同时抢同一天同一时段（期望 success ≤ 车位数，其余 conflict）。

```powershell
$env:BASE_URL = "http://127.0.0.1:3200"
$env:CONCURRENCY = "100"
$env:USER_COUNT = "100"
$env:BOOKING_DATE = "2026-05-21"
$env:PERIOD_ID = "1"
npm run load-test:ev
```

清表：

```sql
DELETE FROM ev_bookings
WHERE booking_date = DATE '2026-05-21' AND period_id = 1;
```

---

## D. Venue 抢订 — 日历级分散

`POST /api/venue-calendar/bookings`；每格容量为 **1**（同房间同日同时段）。冲突多为 **HTTP 400**（`Selected time slot is not available`），脚本计入 `conflict`。

脚本会跳过 seed 中的 **User_EV**（Venue 配额=0），并用工作日日期。

### 准备

1. Admin 已发布 **Venue Booking Date Range** 覆盖测试日期  
2. 清表（按日期改）：

```sql
DELETE FROM venue_bookings
WHERE booking_date >= DATE '2026-09-23'
  AND booking_date <= DATE '2026-10-01'
  AND (status IS NULL OR LOWER(status) <> 'cancelled');
```

### 冒烟 / 300 / 500

```bash
cd TKHO-backend
source scripts/load-test/env/venue-smoke.sh && npm run load-test:venue-calendar
source scripts/load-test/env/venue-300.sh   && npm run load-test:venue-calendar
source scripts/load-test/env/venue-500.sh   && npm run load-test:venue-calendar
```

| 变量 | 说明 | 默认 |
|------|------|------|
| `ROOM_NAMES` | 逗号分隔房间名 | seed 全部 7 间 |
| `TIME_SLOTS` | `HH:mm-HH:mm,...` | `09:00-10:00,10:30-11:30,...` |
| `DAYS` | 工作日天数 | 7 |
| `TARGET_MODE` | `spread` / `hot` / `random` | spread |

**通过标准**：`duplicateRoom = 0`；每格 `success ≤ 1`；重叠校验 SQL 0 行。

```sql
SELECT a.id AS id_a, b.id AS id_b, a.venue_id, a.booking_date::date, a.start_time, a.end_time
FROM venue_bookings a
JOIN venue_bookings b
  ON a.venue_id = b.venue_id AND a.booking_date = b.booking_date AND a.id < b.id
WHERE a.booking_date BETWEEN DATE '2026-09-23' AND DATE '2026-10-01'
  AND (a.status IS NULL OR LOWER(a.status) <> 'cancelled')
  AND (b.status IS NULL OR LOWER(b.status) <> 'cancelled')
  AND a.start_time < b.end_time AND a.end_time > b.start_time;
```

---

## E. Venue 抢订 — 单格热点

多人同时抢同一房间同一时段（期望 `success ≤ 1`，其余多为 `conflict`）。

```bash
source scripts/load-test/env/venue-hot.sh && npm run load-test:venue
```

或：

```powershell
$env:BASE_URL = "http://127.0.0.1:3200"
$env:CONCURRENCY = "100"
$env:USER_COUNT = "100"
$env:BOOKING_DATE = "2026-09-23"
$env:ROOM_NAME = "Conference Room 1"
$env:START_TIME = "10:00"
$env:END_TIME = "11:00"
npm run load-test:venue
```

---

## 推荐执行顺序（300–500）

1. **健康检查**：`GET http://主机:3200/api/health`（或 `:3211/api/health`）  
2. **浏览冒烟** → **浏览 300/500**（`load-test:browse`）  
3. **EV 抢订冒烟** → **spread 300/500** → （可选）`hot`  
4. **Venue 抢订冒烟** → **spread 300/500** → （可选）`venue-hot`  

压测时盯：CPU、Postgres 连接、Redis、Nginx / 后端日志。

---

## 结果字段（抢订）

- **success** / **conflict** / **error**
- **duplicateSlot**：若 &gt;0 表示超卖迹象，需查唯一索引
- **Latency p50/p95**

## 故障排查

| 现象 | 可能原因 |
|------|----------|
| Login failed / 400 corpId | 旧脚本用了 `account`；请用当前仓库脚本 |
| 大量 429 | 提高 `EV_BOOKING_RATE_LIMIT_PER_MIN` 并重启后端 |
| success=0 | 日期不在 window、未清表、无车牌 |
| 浏览大量 fail | BASE_URL 错、未登录系统权限、后端过载 |

## 说明

- 生产库请勿清表做抢订压测；用预发或拷贝库。  
- 经 Nginx 压测更能反映真实入口；纯 API 可用 `:3211`。  
- Seed 仅 25 用户时，300 VU 会复用 token；测「独立账号」需另行扩 seed。
