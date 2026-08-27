# Data Retention

在线库按配置月数滚动保留业务数据；更早记录依赖客户侧 **每日 Data Backup 邮件**，本系统服务器**不另存** retention Excel 归档包。

## 政策摘要

| 项目 | 说明 |
|------|------|
| 默认保留期 | **24 个月**（可在 System Settings 调整） |
| 历史备份 | 客户邮箱收到的每日 / 按配置发送的 Data Backup Excel |
| 服务器角色 | 仅保留在线可查数据；超龄数据由月度任务从生产库删除 |
| 时区 | 定时任务按 **Asia/Hong_Kong (HKT)** |

对客户可表述为：

> 在线系统约保留最近 N 个月数据；更早记录请以每日备份邮件为准。

## 清理规则

每月任务根据 Settings 中的 `data_retention_months`（N）计算 cutoff：

`cutoff ≈ now − N months`

| 数据 | 判定字段 | 条件 | 动作 |
|------|----------|------|------|
| Venue 预订 | `venue_bookings.created_at` | `< cutoff` | 删除（茶水子表随 DB cascade） |
| EV 预订 | `ev_bookings.created_at` | `< cutoff` | 删除 |
| 用户 | `user.inactive_time` + `status` | `status = Inactive` 且 `inactive_time < cutoff` | 删除用户及其车牌 |
| Active 用户 | — | 任意 | **永不删除** |
| SuperAdmin / `is_system_hidden` | — | — | **不纳入** Inactive 用户清理 |

### Inactive 用户与车牌

1. 查出符合条件的 Inactive 用户  
2. 查找其 `license_plates`  
3. 因 EV 预订对车牌为 `ON DELETE NO ACTION`，先删除仍引用这些车牌的 EV 预订（含未满 N 个月的）  
4. 删除车牌  
5. 再删除用户（Venue 预订对人 FK 为 `SET NULL`，未超龄的场地预订行会保留，预订人置空）

## 调度

| 项 | 值 |
|----|----|
| Cron | `0 3 1 * *` |
| 含义 | 每月 **1 日 03:00 HKT** |
| 实现 | `DataRetentionSchedulerService` |
| 防重 | 同一进程内同一 HKT 自然月成功跑过则跳过；失败不记成功，同月可重试 |

## System Settings

**不在** Admin → System Settings 页面展示（与 Data Backup SMTP 等隐藏项相同）。

月度任务仍从 `system_settings` 表读取：

| Setting key | 默认 | 说明 |
|-------------|------|------|
| `data_retention_months` | `24` | 1–120；首次加载 Settings/ensureDefault 时自动写入 |
| `data_retention_ops_email` | （空） | 清理摘要 / 失败告警；空则只写日志不发信 |

运维邮件发件复用 **Data Backup** SMTP（sender / host / password）。

如需改月数或运维邮箱，直接更新数据库，例如：

```sql
UPDATE system_settings
SET setting_value = '24', updated_at = NOW()
WHERE setting_key = 'data_retention_months';

UPDATE system_settings
SET setting_value = 'ops@example.com', updated_at = NOW()
WHERE setting_key = 'data_retention_ops_email';
-- 若行不存在，可由应用 ensureDefaultSettings 先插入默认行后再 UPDATE
```

服务内通过 `getDataRetentionMonths()` / `getDataRetentionOpsEmail()` 读取，不暴露给 GET `/api/system-settings`。

## 运行流程（最小安全项）

1. **计划日志**：清理前统计将删除的预订数、Inactive 用户数、车牌数  
2. **分批删除**：每批最多 500 条，降低长锁风险  
3. **结果日志**：成功 / 失败均写应用日志（含 summary JSON）  
4. **运维邮件**：若配置了 Ops email，发送 SUCCESS / FAILED 摘要；SMTP 失败只记日志，不掩盖 purge 结果  

邮件正文大致包含：retention months、cutoff、各类删除计数、起止时间、失败时的 error。

## 与 Data Backup 的关系

| | Data Backup | Data Retention Purge |
|--|-------------|----------------------|
| 目的 | 给客户留业务快照 | 控制在线库体积与留存期 |
| 频率 | 按 Settings（常为每日） | 每月一次 |
| 是否删库 | 否 | 是（超龄数据） |
| 服务器存 Excel | 否（发邮件） | 否 |

两者应同时启用：Backup 保证客户有历史副本，Retention 保证服务器不无限堆积。

## 代码位置

```
TKHO-backend/src/data-retention/
  data-retention.module.ts
  data-retention.service.ts          # 清理逻辑
  data-retention-scheduler.service.ts
  data-retention-mail.service.ts     # 运维通知
  data-retention.types.ts

TKHO-backend/src/system-settings/system-setting.keys.ts
  data_retention_months
  data_retention_ops_email
```

模块已挂入 `AppModule`。

## 运维检查清单

部署 / 上线后：

1. 确认 `system_settings` 中 `data_retention_months`（默认 24）与按需填写的 `data_retention_ops_email`  
2. 确认 Data Backup SMTP 可用（运维信走同一发件账号）  
3. 重启后端使 `DataRetentionModule` 生效  
4. 月度执行后检查：应用日志关键字 `Data retention purge`、Ops 邮箱是否收到摘要（若已配置）  

可选：在非生产用较短 `data_retention_months` 做验证（务必仅在测试库）。

## 风险与说明

- **不可恢复**：服务器 purge 后无法从本系统恢复；只能依赖客户备份邮件或其它外部备份。  
- **删用户时可能删较新 EV 预订**：若 Inactive 用户仍有未满 N 个月、但挂在其车牌上的 EV 预订，会一并删除以便删车牌。  
- **Venue 预订人变空**：未超龄 Venue 预订在用户被删后 `reserved_by` 等为 null，列表可能显示不出原预订人姓名。  
- **Expired 用户**：当前任务只清理 `Inactive`；`Expired` 不在本任务范围内（如需可另定规则）。  

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-27 | 初版：月度 purge、Settings `data_retention_months` / `data_retention_ops_email`、预订按创建日、Inactive 用户按 inactive_time + 车牌 |
| 2026-08-27 | Data Retention 从 Admin System Settings UI 隐藏；改由 DB / 默认值配置 |
