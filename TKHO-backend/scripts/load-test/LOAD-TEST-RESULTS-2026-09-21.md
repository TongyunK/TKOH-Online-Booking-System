# TKOH 在线预订系统 — 压力测试结果总结

| 项 | 内容 |
|----|------|
| 测试日期 | 2026-09-21 |
| 环境 | Linux Docker 部署（`proj_deploy@LS-272437-54074`） |
| API 入口 | `http://127.0.0.1:3200`（Nginx） |
| 测试账号 | Seed 用户 `E002`–`E025`，密码 `123456`（测试前已执行容器内 seed） |
| 脚本位置 | `TKHO-backend/scripts/load-test/` |
| 执行清单 | [SERVER-CHECKLIST.md](./SERVER-CHECKLIST.md) |

---

## 1. 结论（摘要）

| 场景 | 规模 | 结论 |
|------|------|------|
| 日历浏览 | 30 VU × 30s | **通过** |
| EV 抢订（冒烟） | 10 并发 | **通过**（业务拒绝符合预期） |
| EV 抢订（正式） | 300 并发 spread | **通过**（无超卖；SQL 重复占位 = 0 行） |

在目标规模下系统未出现不可用、未出现同一车位重复占用。失败请求主要为业务规则拒绝（无 EV 配额、周末不可订），不是 5xx 压垮。

---

## 2. 测试前准备

1. 健康检查：`GET /api/health` 正常  
2. 容器内灌种子数据：  
   `docker exec tkho-booking-backend-blue node prisma/seed-dist/seed.js`  
   结果：`users=26, evSlots=3, evPeriods=3, …`  
3. 登录冒烟：`E002` / `123456` / `system=parking` 返回 token  
4. 抢订前将限流写入 `.env` 并重建蓝后端：  
   `EV_BOOKING_RATE_LIMIT_PER_MIN=500`  
5. Booking Date Range 已覆盖全年（浏览日志显示 `2026-01-01 → 2026-12-31`）  
6. 抢订前清表（示例区间 `2026-09-22`～`2026-10-05`，时段 1,2,3）

---

## 3. 日历浏览（读压测）

**命令：** `npm run load-test:browse`

### 3.1 冒烟：30 VU × 30 秒（SYSTEM=both）

| 指标 | 结果 |
|------|------|
| 登录 | 24 个 seed 账号成功，0 失败 |
| 总请求 | ok = **480**，fail = **0** |
| 墙钟时间 | ~30,004 ms |
| 约合 RPS | ~16.0 |

| 接口 | ok | fail | p50 (ms) | p95 (ms) | max (ms) |
|------|----|------|----------|----------|----------|
| GET `/parking/calendar-availability` | 90 | 0 | 93 | 436 | 514 |
| GET `/ev-management/booking-window` | 30 | 0 | 80 | 175 | 176 |
| GET `/ev-management/bookings?scope=my` | 90 | 0 | 47 | 141 | 521 |
| GET `/venue-calendar/rooms` | 90 | 0 | 45 | 142 | 571 |
| GET `/venue-calendar/bookings/week` | 90 | 0 | 46 | 193 | 257 |
| GET `/venue-management/booking-window` | 90 | 0 | 43 | 147 | 149 |

**判定：** 通过（fail=0，p95 远低于 2–3s 建议阈值）。

> 说明：后续若已跑 `VUS=300/500` 正式浏览，可将该轮指标补入本节附表。本次会话中已确认的正式数据以 30 VU 冒烟为准。

---

## 4. EV 抢订（写压测）

**命令：** `npm run load-test:ev-calendar`（`TARGET_MODE=spread`）

### 4.1 冒烟：10 并发

| 指标 | 结果 |
|------|------|
| success | 7 |
| conflict | 0 |
| error | 3 |
| 墙钟 | ~77 ms |
| p95 | ~75 ms |

3 笔 error 均为 **HTTP 403** `EV booking quota exceeded.`（账号如 E003 / E006 / E009）。  
原因：seed 中部分角色为 **User_Venue**（年度 EV 配额 = 0），属预期业务拒绝，非系统故障。

### 4.2 正式：300 并发（spread，14 天 × 时段 1,2,3）

| 指标 | 结果 |
|------|------|
| success | **45** |
| conflict | **37** |
| error | **218** |
| 容量对照 | 45 / 126（空表理论格×车位上限） |
| 墙钟 | ~2,237 ms |
| 延迟 | min 175 · p50 1469 · **p95 2117** · max 2196 ms |
| 满员格（success≥3） | 10 / 42 |

**有活动格子表现：** 多数格为 success=3 + 若干 conflict，与 **3 个 active EV 车位** 一致，未见超卖迹象。

**error 样本（业务规则，非 5xx）：**

| HTTP | 消息 | 说明 |
|------|------|------|
| 403 | `EV booking quota exceeded.` | User_Venue 等无 EV 配额账号 |
| 400 | `Booking is not allowed on weekends...` | 例如 `2026-09-26` 为周六 |

### 4.3 数据库校验（必过项）

```sql
SELECT slot_id, period_id, booking_date, COUNT(*)
FROM ev_bookings
WHERE status IN ('pending', 'confirmed')
  AND booking_date >= DATE '2026-09-22'
  AND booking_date <= DATE '2026-10-05'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

**结果：0 行** → 无同一 `(slot_id, period_id, booking_date)` 重复有效预订。

**判定：** 通过。

---

## 5. 通过标准对照

| 标准 | 浏览 | 抢订 300 |
|------|------|----------|
| fail / 5xx 可控 | fail=0 | 未见压垮类失败；error 为业务 403/400 |
| 延迟可接受 | p95 ≤ 436 ms | p95 ≈ 2.1 s（可接受） |
| 无超卖 / SQL 无重复 | N/A | **0 行** |
| success ≤ 车位容量 | N/A | 单格成功数 ≤ 3 |

---

## 6. 环境与数据注意点（复测时）

1. **Docker 部署不要在宿主机 `npx prisma db seed`**，应：  
   `docker exec tkho-booking-backend-blue node prisma/seed-dist/seed.js`  
2. Seed **会清空并重建演示数据**，仅适合测试库。  
3. Seed 仅约 **25 用户、3 车位**；VU/并发 > 25 会循环复用账号。  
4. bash 环境变量写法：`export VUS=500`（等号两侧无空格）；勿用 PowerShell 的 `$env:...`。  
5. 限流 `EV_BOOKING_RATE_LIMIT_PER_MIN` 需写入项目根 `.env` 并重建后端容器才生效。  
6. 部分 seed 账号无 EV 权限 → 抢订统计中会有固定比例 403，解读时勿当成服务故障。

---

## 7. 建议后续（可选）

- [ ] 补跑浏览正式规模：`VUS=300` 与 `VUS=500`，`DURATION_SEC=120`，记录 ok/fail 与 p95  
- [ ] 抢订 `CONCURRENCY=500`（清表后），再跑一遍重复占位 SQL  
- [ ] 若需「全员可抢 EV」，测试前将 seed 用户 EV 配额统一调高，或仅使用 User / User_EV 账号列表  
- [ ] 生产环境勿清表、勿覆盖 seed；压测请用独立测试库  

---

## 8. 相关文件

| 文件 | 用途 |
|------|------|
| `ev-booking-concurrent.mjs` | 单格抢订 |
| `ev-booking-calendar-stress.mjs` | 多日×多时段抢订 |
| `calendar-browse-stress.mjs` | 日历浏览 |
| `README.md` | 脚本说明 |
| `SERVER-CHECKLIST.md` | 服务器逐步操作清单 |
