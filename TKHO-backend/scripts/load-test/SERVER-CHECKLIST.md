# 服务器压测执行清单（300–500 用户）

适用：Linux 部署机（经 Nginx `3200`）或本机直连后端 `3210`。  
**请在测试/预发环境执行；勿对生产库做抢订清表。**

## 占位说明

| 名字 | 是什么 | 你怎么填 |
|------|--------|----------|
| **HOST** | **服务器地址**（主机名或 IP），**不含** `http://` 和端口 | 在服务器本机压测填 `127.0.0.1`；从别的电脑打这台机，填那台机的 IP，例如 `192.168.1.10` |
| **BASE_URL** | 完整 API 入口 | 拼出来：`http://HOST:3200`（经 Nginx）或 `http://HOST:3211`（直连蓝后端） |

示例：

```bash
# 就在部署机上跑压测脚本时：
export BASE_URL="http://127.0.0.1:3200"

# 从你自己的笔记本压远程服务器时（把 IP 换成真实的）：
export BASE_URL="http://192.168.x.x:3200"
```

### 日期用哪一年？

用 **当前真实日历年**（现在是 **2026**），且必须落在 Admin 已发布的 **EV Booking Date Range** 内。  
下面示例按「今天附近」写了 **2026-09-22** 起连续 14 天；若你后台发布的是别的区间，把所有日期改成那个区间内的日期即可。

| 名字 | 示例（可改） |
|------|----------------|
| `START` | `2026-09-22`（明天起，或 window 内任意起始日） |
| `END` | `2026-10-05`（约 START + 13 天） |

---

## 0. 同步代码与脚本

```bash
cd ~/Documents/TKOH-Online-Booking-System
# 确保已拉取含 scripts/load-test 的最新代码
cd TKHO-backend
node -v   # 需 Node 18+
```

若压测机没有整份 backend 依赖，只要有 `scripts/load-test/*.mjs` 即可（脚本无 npm 依赖）。

---

## 1. 健康检查

在部署机上：

```bash
curl -sS "http://127.0.0.1:3200/api/health"
# 期望返回里 postgres / redis 正常

curl -sS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3200/api/health"
# 期望 200
```

从别的电脑测时，把 `127.0.0.1` 换成服务器 IP。

可选：直连后端蓝环境

```bash
curl -sS "http://127.0.0.1:3211/api/health"
```

Redis / Postgres 容器在跑：

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'postgres|redis|nginx|backend' || true
```

---

## 2. 提高 EV 抢订限流（仅抢订需要）

默认约 **30 次/用户/分钟**，300 并发易 429。在 `.env`（或 compose 环境）增加后**重启后端容器**：

```env
EV_BOOKING_RATE_LIMIT_PER_MIN=500
```

```bash
# 示例：改完 .env 后按你们现用环境重建后端（勿误清数据库卷）
cd ~/Documents/TKOH-Online-Booking-System
# 若当前是蓝：
./deploy.sh blue
# 或仅重启后端容器名（以 docker ps 为准）
# docker restart tkho-booking-backend-blue
```

确认限流已生效（改完需重启才读新环境变量）。

---

## 3. 业务前置（EV 抢订）

在 Admin：

1. **EV Management → Booking Date Range** 已发布，覆盖 `2026-09-22`～`2026-10-05`（或你选用的区间）
2. 确认有 active 车位（seed 默认 3 个）

登录冒烟（应返回 token）：

```bash
curl -sS -X POST "http://127.0.0.1:3200/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"corpId":"E002","password":"123456","system":"parking"}'
```

---

## 4. 清表（仅抢订前；浏览可跳过）

用 Adminer（`http://服务器IP:3201`）或 `psql`。日期与 §3 的 window 一致：

```sql
-- 日历级 spread（14 天 × 时段 1,2,3）— 2026 年示例
DELETE FROM ev_bookings
WHERE booking_date >= DATE '2026-09-22'
  AND booking_date <= DATE '2026-10-05'
  AND period_id IN (1, 2, 3);

-- 确认已空
SELECT COUNT(*) FROM ev_bookings
WHERE status IN ('pending', 'confirmed')
  AND booking_date BETWEEN DATE '2026-09-22' AND DATE '2026-10-05'
  AND period_id IN (1, 2, 3);
-- 期望 0
```

单格热点清表：

```sql
DELETE FROM ev_bookings
WHERE booking_date = DATE '2026-09-22'
  AND period_id = 1;
```

---

## 5. 日历浏览压测

### 5.1 冒烟（约 1 分钟）

```bash
cd ~/Documents/TKOH-Online-Booking-System/TKHO-backend

export BASE_URL="http://127.0.0.1:3200"
export VUS=30
export DURATION_SEC=30
export POLL_MS=10000
export SYSTEM=both
npm run load-test:browse
```

期望：各接口 `fail≈0`。

### 5.2 正式 300 / 500

```bash
export BASE_URL="http://127.0.0.1:3200"
export VUS=300          # 再跑一轮改 500
export DURATION_SEC=120
export POLL_MS=10000
export SYSTEM=both      # parking | room | both
npm run load-test:browse
```

记录：墙钟时间、RPS、各接口 ok/fail、p50/p95。

---

## 6. 抢订压测

### 6.1 冒烟（10 并发）

```bash
export BASE_URL="http://127.0.0.1:3200"
export CONCURRENCY=10
export USER_COUNT=10
export DAYS=14
export START_DATE="2026-09-22"
export PERIOD_IDS="1,2,3"
export TARGET_MODE=spread
npm run load-test:ev-calendar
```

### 6.2 正式 300 / 500（先再清表）

重复 **§4 清表**，然后：

```bash
export BASE_URL="http://127.0.0.1:3200"
export CONCURRENCY=300   # 再跑一轮改 500
export USER_COUNT=300
export DAYS=14
export START_DATE="2026-09-22"
export PERIOD_IDS="1,2,3"
export TARGET_MODE=spread
npm run load-test:ev-calendar
```

### 6.3（可选）单格热点

```bash
export BASE_URL="http://127.0.0.1:3200"
export CONCURRENCY=100
export USER_COUNT=100
export BOOKING_DATE="2026-09-22"
export PERIOD_ID=1
npm run load-test:ev
```

期望：success ≤ active 车位数，其余多为 conflict，`duplicateSlot=0`。

---

## 7. 压测后数据库校验（抢订必做）

```sql
-- 不应有重复占同一车位
SELECT slot_id, period_id, booking_date, COUNT(*) AS cnt
FROM ev_bookings
WHERE status IN ('pending', 'confirmed')
  AND booking_date BETWEEN DATE '2026-09-22' AND DATE '2026-10-05'
GROUP BY slot_id, period_id, booking_date
HAVING COUNT(*) > 1;
-- 期望 0 行

-- 容量对照（单格）
SELECT
  (SELECT COUNT(*) FROM ev_parking_slots WHERE status = 'active') AS total_slots,
  (SELECT COUNT(*) FROM ev_bookings
   WHERE status IN ('pending', 'confirmed')
     AND booking_date = DATE '2026-09-22'
     AND period_id = 1) AS bookings;
```

---

## 8. 通过标准（勾选）

**浏览**

- [ ] `fail` 接近 0（或失败率 &lt; 5%）
- [ ] 主要读接口 p95 可接受（建议 &lt; 2–3s，视机器而定）
- [ ] 压测期间 `/api/health` 仍 200

**抢订**

- [ ] `duplicateSlot = 0`
- [ ] SQL 无重复 `(slot_id, period_id, booking_date)`
- [ ] `success` ≤ 理论容量；其余多为 `conflict`，非大量 `error`/`429`
- [ ] 429 过多 → 检查限流是否已提高到 500 并重启

---

## 9. 常见问题

| 现象 | 处理 |
|------|------|
| Login 400 / corpId | 确认用的是当前仓库脚本（已用 `corpId`） |
| 大量 429 | `EV_BOOKING_RATE_LIMIT_PER_MIN=500` + 重启后端 |
| success=0 | 清表、检查 Booking Date Range 是否覆盖 2026 测试日、账号有车牌 |
| 连接失败 | `BASE_URL` 端口、防火墙、Nginx 是否在跑 |
| Seed 仅 25 用户 | VU&gt;25 会复用账号；浏览可接受；抢订注意限流与周限额 |

---

## 10. 结果记录模板（可复制）

```text
日期:
BASE_URL: http://127.0.0.1:3200
机器配置:

[浏览] VUS=  DURATION=  SYSTEM=
  ok/fail:
  p95 (calendar-availability / week):
  备注:

[抢订] CONCURRENCY=  TARGET_MODE=spread  START=2026-09-22
  success/conflict/error:
  duplicateSlot:
  p95:
  SQL 重复行数:
  备注:
```
