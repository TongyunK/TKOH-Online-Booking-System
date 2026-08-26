# 会话交接文档

> 写给完全没有上下文的新会话。最后更新：2026-08-26

---

## 1. 我们在做什么

TKOH Online Booking System 管理端与后端迭代。本会话在上一轮「Data Backup 配置」基础上，已**落地定时/手动备份发信**，并清理若干遗留 schema，打磨备份 Excel 列，以及若干产品配置与 UI 修复。

---

## 2. 本会话已完成内容

### 2.1 Data Backup 模块（已实现）

路径：`TKHO-backend/src/data-backup/`

| 文件 | 作用 |
|------|------|
| `data-backup-report.service.ts` | 生成多 sheet Excel（xlsx） |
| `data-backup-mail.service.ts` | nodemailer 发信；默认 **SMTP 465 + secure**；`tls.rejectUnauthorized: false` |
| `data-backup-scheduler.service.ts` | 每分钟 cron（HKT）；按 interval + send time 触发；`POST /api/data-backup/send-now` |
| `data-backup.controller.ts` | `send-now`（AdminRoleGuard） |
| 注册于 `app.module.ts` | |

**日期范围**：预订类 sheet 为「今天起未来 N 天」（`data_backup_time_span`）；主数据为全量快照。

**Excel sheets（当前）**：

Summary、Venue Bookings、EV Bookings、Users、Pending Users、Venues、Venue Blocks、License Plates、EV Parking Slots、EV Time Periods、Departments、Access Roles、Booking Windows、Prompts、**System Settings**、**Display Config Settings**

**导出规则摘要**：

- 人名列多为 `Name（CORP ID）` 合并格式
- Access Roles：**不导出 SuperAdmin**（与系统其它列表一致）
- Users：排除 `isSystemHidden`
- System Settings：**不导出 key 含 `password` 的项**（当前即 SMTP 密码）
- 多数业务 sheet 保留数据库 ID；曾短暂去掉又按用户要求恢复

**前端**：`SystemSettings.vue` 有 Data Backup 卡片 + **Send backup now**（先保存 backup 相关设置再调 API，timeout 120s）；提示用 `BookingStyleModal`。`systemSettings.js`：`sendDataBackupNow()` 必须 `post({}, …)`，不要 `null`。

**SMTP（本地曾踩坑后现状）**：

- 密码：`enc:v1:` + AES（密钥 `SETTINGS_ENCRYPTION_KEY` 或 `JWT_SECRET`）
- 解密失败会回退 env `DATA_BACKUP_SENDING_EMAIL_PASSWORD`
- 本地曾改用 **163**：`smtp.163.com` + 授权码；Wise 旧密码曾 535
- 相关脚本：`scripts/set-data-backup-smtp-config.ts`、`test-data-backup-smtp.ts`、`reencrypt-data-backup-password.ts` 等

**Cron 注意**：Nest 进程休眠/关机错过 09:00 **不会补发**。

### 2.2 Schema / 鉴权清理（本会话迁移）

路径：`TKHO-backend/prisma/migrations/`（本地多数已 `migrate deploy`）

| 迁移 | 内容 |
|------|------|
| `20260826110000_drop_user_account` | 删除 `user.account`；登录仅 `corpId` |
| `20260826120000_drop_pending_users_access_role_id` | Pending 注册不再存角色；审批时再赋角色 |
| `20260826130000_drop_departments_employee_count` | 删除未使用的 `departments.employee_count`（UI 人数仍实时统计） |
| `20260826140000_drop_merge_group_and_account_vehicles` | 删 `display_venue_rules.merge_group`；删整表 `account_vehicles`（车牌 API 已用 `license_plates`） |
| `20260826150000_venue_meeting_event_title_max_length` | 写入 Meeting/Event Title 最大字数配置 |

**登录**：payload 用 `corpId`（前端 `Login.vue` / 后端 `login.dto.ts`）。

**Pending 审批**：`ApprovePendingDto.role` 必填；前端审批前校验角色。

### 2.3 Meeting / Event Title 最大字数（可配置）

- DB key：`venue_meeting_event_title_max_length`，默认 **80**，Admin 可调 **1–500**
- Keys / defaults：`system-setting.keys.ts`
- System Settings 新卡片「Meeting / Event Title」
- 前端缓存工具：`TKHO-frontend/src/utils/meetingEventTitleMaxLength.js`（Save Settings 后会 `invalidate`）
- 已接：`VenueBookingDialog`、`VenueManageBooking`、`MeetingApproval`
- 后端：`assertMeetingEventTitleLength()`；相关 DTO `@MaxLength(500)` 作硬顶，业务按配置校验

### 2.4 EV Booking 日期选择器被裁切（UI 修复）

**文件**：`TKHO-frontend/src/components/EVBookingDialog.vue`

**原因**：`:teleported="false"` + 弹窗 `overflow: hidden` → 日历面板被裁；内容区滚动也滚不到面板外溢部分。难复现条件：管理员（多 Reserved By）、矮视口、14" zoom、Date 在表单底部。

**修复（对齐 VenueBookingDialog）**：

- 非 14" zoom：`teleported=true` 挂 body
- 14" zoom：`teleported=false` + 日历 `placement="top-start"`
- 弹窗 `overflow: visible`；遮罩可滚

### 2.5 遗留数据结论（已删）

- `merge_group`：Merge 大屏按 `display_type=merge` 取场地，字段无业务用处 → 已删
- `account_vehicles`：无任何 `prisma.account_vehicles` 调用 → 表已删；`AccountVehiclesModule` API 保留（底层 `license_plates`）

---

## 3. `system_settings` 键一览（当前）

| DB key | Admin 可见 | 默认 / 说明 |
|--------|------------|-------------|
| `user_inactive_after_months` | 是 | `6` |
| `hk_public_holidays_url` | 是 | 1823 JSON |
| `EV_date_update_time` | 是 | `13:00` |
| `EV_weekly_booking_limit` | 是 | `1` |
| `venue_booking_min_gap_minutes` | 是 | `15` |
| `venue_meeting_event_title_max_length` | 是 | `80`（1–500） |
| `data_backup_receiving_email` | 是 | 空 |
| `data_backup_time_span` | 是 | `14` |
| `data_backup_email_interval` | 是 | `daily` / weekly / monthly |
| `data_backup_email_send_time` | 是 | `09:00` |
| `data_backup_sending_email` | **否** | env 可覆盖 |
| `data_backup_sending_email_host` | **否** | env 可覆盖 |
| `data_backup_sending_email_password` | **否** | `enc:v1:`；env 可回退 |

---

## 4. 当前状态 / 未完成 / 风险

1. **大量改动未 git commit**（用户规则：仅明确要求时才 commit）。`main` 上大量 modified + 本会话 5 个未跟踪迁移。
2. **生产未确认**：`prisma migrate deploy`、SMTP 密文与生产 `JWT_SECRET` 是否匹配、收件邮箱是否已配。
3. **`prisma generate` EPERM**：Windows 上 Nest 占用 Prisma DLL 时会失败 → 先停后端再 generate。
4. **HK holidays sync**（03:00 HKT）若 DNS 失败（`ENOTFOUND www.1823.gov.hk`）与 backup 无关。
5. **`access_roles.employee_count` 列仍在 schema**（Departments 的已删）；Access Roles 备份 sheet 仍导出该字段；UI User Count 为实时统计。
6. Data Backup Excel 列裁剪是迭代产品决策，后续若再改列，集中改 `data-backup-report.service.ts`。

---

## 5. 下一步建议

### P0 — 生产部署清单

```powershell
cd TKHO-backend
npx prisma migrate deploy
# 停 Nest 后再：
npx prisma generate
# 重启后端 / 前端
```

验证：

```sql
SELECT setting_key, left(setting_value, 40)
FROM system_settings
ORDER BY setting_key;
```

- Data Backup：收件邮箱、SMTP 发件/host/密码（或 env）
- 用 Admin「Send backup now」试发一封
- Title max length 在 System Settings 改一下，Venue 预订弹窗字数是否跟着变

### P1 — 可选收尾

- 用户明确要求后再 **git commit / PR**
- 是否删除 `access_roles.employee_count`（与 departments 同理）
- 是否补 Data Backup sheet：`display_venue_rules` / `hk_public_holidays` 等
- Cron 漏发是否要做 catch-up（当前不做）

---

## 6. 踩过的坑（不要再踩）

### 6.1 14" `html { zoom: 0.8 }` + Element Plus

- Admin 提示：**`BookingStyleModal` + `showNotice()`**，不用 `ElMessage`/`ElMessageBox` 挂 `#app`
- 浮层：zoom 断点内常 `:teleported="false"`；断点外挂 body 以免被 `overflow` 裁切（见 EV/Venue Booking Dialog）

### 6.2 SMTP / 加密

- 密文绑定加密密钥（`SETTINGS_ENCRYPTION_KEY` 或 `JWT_SECRET`）；换密钥要重加密
- 163 等要用**授权码**不是登录密码；Wise 曾 535
- `sendDataBackupNow` body 用 `{}` 不是 `null`

### 6.3 Prisma Windows EPERM

Nest 占用 `query_engine-windows.dll.node` → generate 失败。停后端再 generate。

### 6.4 SuperAdmin 不可对普通 Admin 暴露

列表、备份 Access Roles、用户列表等均已过滤；新增导出/下拉时沿用 `isSuperAdminRole`。

### 6.5 备份 Excel ≠ 严格 DB dump

省略 password、过滤 SuperAdmin；ID 已恢复便于对照。严格主键级还原需另做方案。

---

## 7. 关键文件速查

```
HANDOFF.md

TKHO-backend/src/data-backup/*
TKHO-backend/src/system-settings/*
TKHO-backend/src/meeting-approval/*
TKHO-backend/src/venue-calendar/venue-calendar.service.ts
TKHO-backend/src/venue-management/venue-management.service.ts
TKHO-backend/prisma/migrations/202608261*

TKHO-frontend/src/components/admin/SystemSettings.vue
TKHO-frontend/src/api/systemSettings.js
TKHO-frontend/src/utils/meetingEventTitleMaxLength.js
TKHO-frontend/src/components/EVBookingDialog.vue
TKHO-frontend/src/components/VenueBookingDialog.vue
TKHO-frontend/src/views/VenueManageBooking.vue
TKHO-frontend/src/components/admin/MeetingApproval.vue
TKHO-frontend/src/views/Login.vue

env.production / TKHO-backend/.env
```

---

## 8. 用户偏好（后续会话请遵守）

- 回复使用 **中文**
- Shell 使用 **PowerShell** 语法
- **不要主动 git commit / push**，除非用户明确要求
- 改代码：**最小 diff**，匹配现有风格
- System Settings / Admin 提示走 **BookingStyleModal**，注意 14" zoom

---

## 9. 新会话第一句话可以做什么

> 「请读 `HANDOFF.md`，帮我检查本地/生产迁移是否都已 deploy，并用 Send backup now 验证发信。」

或：

> 「请读 `HANDOFF.md`，把本会话未提交改动整理成 commit（或拆 PR）。」

或：

> 「请读 `HANDOFF.md`，评估是否删除 `access_roles.employee_count`，并补备份 sheet。」
