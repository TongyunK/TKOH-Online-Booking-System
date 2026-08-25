# 会话交接文档

> 写给完全没有上下文的新会话。最后更新：2026-08-25

---

## 1. 我们在做什么

TKOH Online Booking System 的管理端与后端迭代，本阶段核心目标是：

1. **System Settings / Data Backup**：在 `/admin/system-settings` 增加数据备份邮件相关配置，写入 `system_settings` 表；Admin 可编辑可见项，SMTP 敏感项隐藏。
2. **Admin UI 多项调整**（同一会话早期完成）：Venue Manage Booking、Meeting Approval、User Management、Prompt Management 等页面的列顺序、字段、布局优化。
3. **用户 inactive 审计**：`users.inactived_by` 字段及前后端展示。

**尚未开始的核心功能**：按计划定时发送数据备份邮件（cron + SMTP 发信 + 报表生成）。

---

## 2. 已完成内容

### 2.1 System Settings — Data Backup（前端）

**文件**：`TKHO-frontend/src/components/admin/SystemSettings.vue`

- 新增 **Data Backup** 卡片，Admin 可见字段：
  - Receiving email
  - Time span (days)，默认 14
  - Send interval：Daily / Weekly / Monthly
  - Send time (HH:mm)，默认 09:00
- 布局：一行三列 flex 卡片；末行不足 3 张时不拉伸铺满；数字/时间输入框固定窄宽（~140px）；URL/邮箱全宽。
- 保留 **Current** 绿色 pill、简短 `field-hint`、**Open link in new tab** 链接样式、**Last updated** 底部 footer。
- 白色 `.settings-panel` 铺满视口高度（与其他 Admin 页一致）。
- 保存/错误提示使用 **`BookingStyleModal` + `showNotice()`**（与 User Management 等一致），**不要用 `ElMessage` / `ElMessageBox` 挂 `#app`**。

### 2.2 System Settings — Data Backup（后端）

**关键文件**：

| 文件 | 作用 |
|------|------|
| `TKHO-backend/src/system-settings/system-setting.keys.ts` | 所有 key 常量、默认值、隐藏 key 列表 |
| `TKHO-backend/src/system-settings/system-settings.service.ts` | 读写、隐藏项 getter、密码加解密 |
| `TKHO-backend/src/system-settings/dto/update-system-settings.dto.ts` | Admin 可提交的字段校验 |
| `TKHO-backend/src/common/settings-secret.crypto.ts` | AES-256-GCM 加密（`enc:v1:` 前缀） |
| `TKHO-backend/scripts/encrypt-setting-secret.ts` | 手动生成加密串 |

**`system_settings` 键一览**：

| DB key | Admin 可见 | 默认值 / 说明 |
|--------|------------|---------------|
| `data_backup_receiving_email` | 是 | 空 |
| `data_backup_time_span` | 是 | `14` |
| `data_backup_email_interval` | 是 | `daily` |
| `data_backup_email_send_time` | 是 | `09:00` |
| `data_backup_sending_email` | **否** | 空；env: `DATA_BACKUP_SENDING_EMAIL` |
| `data_backup_sending_email_host` | **否** | `mail.wisesystemtech.com`；env: `DATA_BACKUP_SENDING_EMAIL_HOST` |
| `data_backup_sending_email_password` | **否** | AES 加密存储；env: `DATA_BACKUP_SENDING_EMAIL_PASSWORD` |

**隐藏项 getter**（供后续发信用）：

- `getDataBackupSendingEmail()`
- `getDataBackupSendingEmailHost()`
- `getDataBackupSendingEmailPassword()` — 读 DB 后解密

**密码加密**：

- 密钥：`SETTINGS_ENCRYPTION_KEY`，未设置则回退 `JWT_SECRET`
- 启动时若 DB 中为明文密码，会自动加密写回
- 迁移 `20260825170000` 写入的是用 **`env.production` 里那份 `JWT_SECRET`** 加密后的密文（见踩坑）

### 2.3 数据库迁移（本阶段相关）

路径：`TKHO-backend/prisma/migrations/`

| 迁移 | 内容 |
|------|------|
| `20260825160000_data_backup_system_settings` | 初始 6 个 data backup 键 |
| `20260825170000_encrypt_data_backup_sending_password` | 写入加密后的 SMTP 密码 |
| `20260825180000_data_backup_sending_email_host` | 写入 `mail.wisesystemtech.com` |

同会话其他迁移（可能尚未 deploy）：`user_inactived_by`、`venue_bookings_cancelled_at` 等。

### 2.4 同会话其他已完成改动（摘要）

- **UserManagement**：姓名字段顺序、Add User 去掉 Reason、可选车牌、去掉 Delete、`inactived_by` 列
- **MeetingApproval / VenueManageBooking**：Tea Service、Display on Homepage 列及弹窗
- **PromptManagement**：去掉 Meeting Approval 子标签
- **User inactivity**：`inactived_by` schema + 手动/系统自动写入逻辑

---

## 3. 当前卡在哪 / 未验证项

1. **数据备份发信逻辑未实现**  
   仅有配置存储与 getter，没有 cron、没有 nodemailer/邮件模块、没有备份报表内容生成。

2. **`data_backup_sending_email`（发件邮箱地址）可能仍为空**  
   本会话只配置了 host 和加密 password，发件邮箱需确认 DB 或 env 是否已填。

3. **迁移是否已在目标环境执行未知**  
   本地/生产需确认：`npx prisma migrate deploy` 是否已跑，以及 `system_settings` 实际行是否存在。

4. **SMTP 密码解密依赖 JWT_SECRET 一致**  
   若 dev 用 `change-me...`、生产用 `env.production` 的密钥，迁移里的密文在 dev 无法解密。

5. **未创建 git commit**  
   用户规则要求仅在明确要求时 commit；当前改动可能大量处于 unstaged/uncommitted 状态。

---

## 4. 下一步计划（建议顺序）

### P0 — 部署与验证配置

```powershell
cd TKHO-backend
npx prisma migrate deploy
# 重启后端
```

验证 SQL：

```sql
SELECT setting_key, setting_value
FROM system_settings
WHERE setting_key LIKE 'data_backup%';
```

确认：

- `data_backup_sending_email_host` = `mail.wisesystemtech.com`
- `data_backup_sending_email_password` 以 `enc:v1:` 开头
- `data_backup_sending_email` 有值（若无则 INSERT 或设 env）

### P1 — 实现 Data Backup 发信

建议新建模块，例如 `TKHO-backend/src/data-backup/`：

1. 读取配置：`SystemSettingsService` 的 getter + receiving email / interval / send time / time span
2. SMTP：host、port（默认 587? 需确认 WiseSystem 要求）、user、pass
3. 定时任务：`@nestjs/schedule` cron，按 HKT `data_backup_email_send_time` + interval 触发
4. 报表内容：按 time span 导出未来 N 天预订等（业务规则需与产品确认）
5. 失败告警与日志

### P2 — 可选增强

- Admin 隐藏项改由 env 注入文档化（`env.production` 补 `DATA_BACKUP_*`）
- SMTP port / TLS 是否也要进 `system_settings`
- 发信集成测试（staging 不向真实收件人发）

---

## 5. 踩过的坑（绝对不要再踩）

### 5.1 14 寸屏 `html { zoom: 0.8 }` 与 Element Plus 浮层

**现象**：`ElMessage` / `ElMessageBox` 挂 `body` 或 `#app` 时，提示条掉到页面左下/底部，或弹窗无法关闭。

**原因**：`TKHO-frontend/src/style.css` 在 1100–1599px 宽度对 `html` 做 zoom，Teleport 到 body 的 fixed 定位会错位。

**正确做法**：

- Admin 页内提示用 **`BookingStyleModal` + `showNotice()`**（见 `UserManagement.vue`、`SystemSettings.vue`）
- 下拉/Popover 在 zoom 断点内用 **`:teleported="false"`**（项目内多处已有注释，如 `UserManagement.vue`、`VenueBookingDialog.vue`）

**不要**：在 System Settings 再用 `ElMessage`/`ElMessageBox` + `appendTo: '#app'`。

### 5.2 Save 按钮一直转圈

**原因**：`await showAlert(...)` 等待 MessageBox 关闭，但弹窗因 zoom 无法交互，Promise 永不 resolve，`saving` 无法复位。

**正确做法**：保存完成后 `showNotice(...)` 同步打开 Modal；`saving = false` 放在 `finally`，且 **不要 await** 弹窗。

### 5.3 System Settings 布局反复横跳

- `page-container--fit-content`：内容随高度收缩 → 底部露出米色背景（用户不喜欢）
- `height: 100%` + `settings-panel flex:1` + footer `margin-top: auto`：与其他 Admin 页一致、白色铺满

**当前方案**：普通 `page-container`（100% 高）+ 内层 `.settings-panel` 白色铺满。

### 5.4 加密密码与 JWT_SECRET 绑定

迁移 `20260825170000` 中的密文是用 **`env.production` 的 `JWT_SECRET`** 生成的。

- dev 密钥不同 → 解密失败 → SMTP 发信会报错
- 换密钥后需用 `scripts/encrypt-setting-secret.ts` 重新生成并 UPDATE DB

**不要**：在 migration SQL 里写明文密码。

### 5.5 隐藏 setting 不要暴露给 GET API

`getSettings()` 只返回 Admin 可见字段；`SYSTEM_SETTING_HIDDEN_KEYS` 中的项仅通过专用 getter 给后端内部使用。

### 5.6 Prisma 迁移顺序

多个 `20260825*` 迁移互不依赖但需一次性 deploy；漏跑会导致 key 缺失或密码仍是明文。

---

## 6. 关键文件速查

```
TKHO-frontend/src/components/admin/SystemSettings.vue   # Admin 配置页
TKHO-frontend/src/views/AdminManagement.vue             # admin 布局壳
TKHO-frontend/src/style.css                             # html zoom 断点
TKHO-frontend/src/components/BookingStyleModal.vue      # 标准弹窗

TKHO-backend/src/system-settings/
TKHO-backend/src/common/settings-secret.crypto.ts
TKHO-backend/prisma/migrations/202608251*
TKHO-backend/scripts/encrypt-setting-secret.ts
TKHO-backend/.env.example
env.production                                          # 生产 JWT_SECRET 等
```

---

## 7. 环境变量备忘

```env
# 加密（可选，默认同 JWT_SECRET）
SETTINGS_ENCRYPTION_KEY=

# Data backup SMTP（DB 优先；Admin 不可见项可只用 env）
DATA_BACKUP_SENDING_EMAIL=
DATA_BACKUP_SENDING_EMAIL_HOST=
DATA_BACKUP_SENDING_EMAIL_PASSWORD=
```

---

## 8. 用户偏好（后续会话请遵守）

- 回复使用 **中文**
- Shell 使用 **PowerShell** 语法
- **不要主动 git commit**，除非用户明确要求
- 改代码：**最小 diff**，匹配现有项目风格

---

## 9. 新会话第一句话可以做什么

> 「请读 `HANDOFF.md`，然后执行 P0 验证迁移与 `system_settings` 数据；若通过，开始实现 P1 Data Backup 定时发信。」

或：

> 「请读 `HANDOFF.md`，帮我在 DB 填入 `data_backup_sending_email` 并写一个 SMTP 连通性测试接口。」
