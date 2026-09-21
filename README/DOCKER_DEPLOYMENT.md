# TKHO 在线预订系统 — Docker 部署指南

参考 `orderFood-system/data-analysis-system-cloud` 的蓝绿部署结构，针对本项目技术栈做了适配：

| 组件 | 参考项目 | TKHO 项目 |
|------|----------|-----------|
| 数据库 | MySQL | **PostgreSQL 15**（`postgres:15-alpine`，与 VisitorSystem 一致） |
| 消息队列 | RabbitMQ | 无 |
| 缓存 | Redis | Redis 7 |
| 后端 | Express | **NestJS + Prisma** |
| 前端 | Vite | Vue 3 + Vite |

## 目录结构

```
TKOH-Online-Booking-System/
├── TKHO-backend/              # NestJS 后端
├── TKHO-frontend/             # Vue 前端
├── docker/
│   ├── backend/Dockerfile
│   ├── backend/docker-entrypoint.sh   # 启动前 prisma migrate deploy
│   ├── frontend/Dockerfile
│   ├── adminer/Dockerfile     # 数据库 Web 管理（参考 VisitorSystem）
│   └── nginx/                 # 入口与 SPA 配置
│       └── ssl/               # HTTPS 证书（cert.pem、key.pem，见 ssl/README.md）
├── docker-compose.base.yml    # PostgreSQL + Adminer
├── docker-compose.redis.yml   # Redis
├── docker-compose.blue.yml    # 蓝环境
├── docker-compose.green.yml   # 绿环境
├── docker-compose.nginx.yml   # 统一入口
├── env.production             # 环境变量模板
├── deploy.ps1                 # Windows 部署脚本
├── deploy.sh                  # Linux 部署脚本
└── switch-nginx-env.sh        # 仅切换 Nginx 蓝绿流量（nginx reload）
```

## 端口规划

| 服务 | 宿主机端口 | 说明 |
|------|-----------|------|
| Nginx HTTP | **3200** | `http://localhost:3200` |
| Nginx HTTPS | **3243** | `https://localhost:3243`（映射容器 **443**，需先配置 SSL 证书） |
| **Adminer** | **3201** | 数据库 Web 管理（容器内外均为 3201）`http://localhost:3201` |
| 后端蓝 | 3211 | 直连调试 |
| 前端蓝 | 3212 | 直连调试 |
| 后端绿 | 3213 | 绿环境 |
| 前端绿 | 3214 | 绿环境 |
| PostgreSQL | 25432 | 外部工具连接 |
| Redis | 6279 | 外部工具连接 |

## 部署与更新命令速查

以下命令均在项目根目录 `TKOH-Online-Booking-System` 执行。Windows 用 `.\deploy.ps1`，Linux/macOS 用 `./deploy.sh`（将示例中的 `.\deploy.ps1` 换成 `./deploy.sh` 即可）。

### 一、首次部署

```powershell
cd TKOH-Online-Booking-System

# 1. 环境变量（仅首次）
Copy-Item env.production .env
notepad .env   # 修改 DB_PASSWORD、REDIS_PASSWORD、JWT_SECRET

# 2. 一键部署：网络 + Postgres + Adminer + Redis + 蓝环境 + Nginx + 流量切到蓝
.\deploy.ps1 blue
```

访问：HTTP `http://localhost:3200` · HTTPS `https://localhost:3243` · Adminer `http://localhost:3201`

---

### 二、发布新版本（蓝绿）

| 步骤 | 命令 | 说明 |
|------|------|------|
| 1. 部署待上线环境 | `.\deploy.ps1 green` | 构建绿环境并启动；会停止蓝应用容器，**数据库/Redis 不重启** |
| 2. 直连验证 | 浏览器访问 `http://localhost:3213/api/health`、`http://localhost:3214` | 不经过入口 Nginx |
| 3. 切换流量 | `.\deploy.ps1 switch green` 或 `./switch-nginx-env.sh green` | 更新 Nginx 并 **reload**（不重建 Nginx 容器） |
| 4. 回滚 | `.\deploy.ps1 switch blue` 或 `./switch-nginx-env.sh blue` | 流量切回蓝（需蓝容器仍在运行；若已 down 需先部署蓝环境） |

仅切换流量、不重新构建应用：

```bash
chmod +x switch-nginx-env.sh deploy.sh
./switch-nginx-env.sh green   # 或 blue / status
```

---

### 三、日常更新（同环境重建）

改代码后，在当前活跃环境上**重新构建并启动**：

```powershell
# 当前跑的是蓝环境
.\deploy.ps1 blue

# 当前跑的是绿环境
.\deploy.ps1 green
```

等价于 compose 合并启动并 `--build`（脚本内已包含）。

**只更新某一类服务**（需已存在 `.env` 与 `tkho-booking-network`）：

```powershell
# 仅重建蓝环境前后端
docker compose -f docker-compose.base.yml -f docker-compose.redis.yml -f docker-compose.blue.yml up -d --build

# 仅重建绿环境前后端
docker compose -f docker-compose.base.yml -f docker-compose.redis.yml -f docker-compose.green.yml up -d --build

# 仅重建 Nginx（改 nginx 配置或证书后）
docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx

# 仅重建基础服务（Postgres / Adminer）
docker compose -f docker-compose.base.yml up -d --build

# 仅重建 Redis
docker compose -f docker-compose.redis.yml up -d --force-recreate redis
```

---

### 四、运维与排查

```powershell
# 查看各 compose 栈状态
.\deploy.ps1 status

# 查看帮助
.\deploy.ps1 help

# 查看日志（将容器名换成实际名称）
docker logs -f tkho-booking-backend-blue
docker logs -f tkho-booking-backend-green
docker logs -f tkho-booking-nginx
docker logs -f tkho-booking-postgres

# 进入后端容器
docker exec -it tkho-booking-backend-blue sh

# 手动执行数据库迁移（一般 entrypoint 已自动 migrate deploy）
docker exec -it tkho-booking-backend-blue npx prisma migrate deploy

# 空库灌演示数据（会 deleteMany 重建 seed 表数据，仅适合测试库；需镜像含 prisma/seed-dist/seed.js）
docker exec tkho-booking-backend-blue node prisma/seed-dist/seed.js
# 或
docker exec tkho-booking-backend-blue npx prisma db seed
```

容器日志已配置轮转：`max-size=50m`、`max-file=3`（单容器大约最多约 150MB，超出自动丢弃最旧文件）。  
**需 recreate 容器后生效**（例如重新 `./deploy.sh blue`，或对各栈 `docker compose ... up -d --force-recreate`）。

---

### 五、停止与清理

**云端 Linux 服务器**（在项目目录执行，使用 `docker-compose` 或 `docker compose` 与现场一致即可）：

```bash
cd ~/Documents/TKOH-Online-Booking-System

# 1. 停掉所有 TKHO 栈
docker-compose -f docker-compose.nginx.yml down
docker-compose -f docker-compose.base.yml down
docker-compose -f docker-compose.redis.yml down
docker-compose -f docker-compose.blue.yml down
docker-compose -f docker-compose.green.yml down 2>/dev/null || true

# 2. 删除本项目相关容器（若仍有残留）
docker ps -a --filter "name=tkho-booking" -q | xargs -r docker rm -f

# 3. 删除本项目自建镜像（勿用 awk 解析 docker images 表格，新版会报 invalid reference format）
docker images --format '{{.Repository}}:{{.Tag}}' | grep tkho-booking | xargs -r docker rmi -f
docker images --filter "reference=*tkho-booking-images*" -q | xargs -r docker rmi -f
docker rmi -f tkho-booking-nginx 2>/dev/null || true

# 4. 从 16 换到 15 必须删库卷，否则 Postgres 无法启动
docker volume rm tkho_postgres_data_volumes tkho_redis_data_volumes tkho_uploads_data_volumes

# 5. 拉最新代码后全量重部署
git pull
./deploy.sh blue
```

> **注意**：删 `tkho_postgres_data_volumes` 会清空数据库，需靠 `prisma migrate deploy` 重新建表；若有生产数据请先备份。

**本地 Windows**：

```powershell
.\deploy.ps1 cleanup
docker volume rm tkho_postgres_data_volumes tkho_redis_data_volumes tkho_uploads_data_volumes
```

---

### 六、HTTPS 证书

```powershell
# 部署脚本会在启动 Nginx 前尝试自动生成自签名证书（需本机有 openssl）
.\deploy.ps1 blue

# 或手动生成后重建 Nginx
cd docker\nginx\ssl
openssl genrsa -out key.pem 2048
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/CN=localhost"
cd ..\..\..
docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx
```

---

### 七、Linux / macOS 完整指令

```bash
cd TKOH-Online-Booking-System

# 赋予执行权限（首次）
chmod +x deploy.sh switch-nginx-env.sh

# ---------- 首次部署 ----------
cp env.production .env
vim .env    # 修改 DB_PASSWORD、REDIS_PASSWORD、JWT_SECRET

./deploy.sh blue

# ---------- 发布新版本（蓝绿）----------
./deploy.sh green
curl -s http://localhost:3213/api/health
./switch-nginx-env.sh green    # 推荐：仅 reload Nginx，零停机切换
# 或: ./deploy.sh switch green

# ---------- 回滚流量 ----------
./switch-nginx-env.sh blue
# 或: ./deploy.sh switch blue

# ---------- 同环境更新（重建镜像）----------
./deploy.sh blue    # 或 ./deploy.sh green

# ---------- 仅切换 Nginx（不构建应用）----------
./switch-nginx-env.sh status
./switch-nginx-env.sh blue
./switch-nginx-env.sh green

# ---------- 按需 compose ----------
docker compose -f docker-compose.base.yml -f docker-compose.redis.yml -f docker-compose.blue.yml up -d --build
docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx

# ---------- 运维 ----------
./deploy.sh status
docker logs -f tkho-booking-backend-blue
docker exec -it tkho-booking-backend-blue npx prisma migrate deploy

# ---------- 清理 ----------
./deploy.sh cleanup
```

| Windows | Linux / macOS |
|---------|----------------|
| `.\deploy.ps1 blue` | `./deploy.sh blue` |
| `.\deploy.ps1 green` | `./deploy.sh green` |
| `.\deploy.ps1 switch green` | `./deploy.sh switch green` 或 `./switch-nginx-env.sh green` |
| `.\deploy.ps1 status` | `./deploy.sh status` 或 `./switch-nginx-env.sh status` |
| `.\deploy.ps1 cleanup` | `./deploy.sh cleanup` |

访问：`http://localhost:3200` · `https://localhost:3243` · Adminer `http://localhost:3201`

---

## 快速开始（Windows）

```powershell
cd TKOH-Online-Booking-System

# 1. 准备环境变量
Copy-Item env.production .env
notepad .env   # 修改 DB_PASSWORD、REDIS_PASSWORD、JWT_SECRET

# 2.（可选）生成 HTTPS 自签名证书
cd docker\nginx\ssl
openssl genrsa -out key.pem 2048
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/CN=localhost"
cd ..\..\..

# 3. 首次部署（蓝环境 + Nginx）
.\deploy.ps1 blue

# 4. 访问
# HTTP:  http://localhost:3200
# HTTPS: https://localhost:3243
# API 文档: http://localhost:3200/api/docs
# Adminer: http://localhost:3201
```

> 未放置 `cert.pem` / `key.pem` 时，Nginx 可能无法启动 HTTPS；HTTP（3200）与健康检查仍可用。证书说明见 `docker/nginx/ssl/README.md`。

### Adminer 登录（与 `.env` 一致）

| 字段 | 值 |
|------|-----|
| 系统 | PostgreSQL |
| 服务器 | `postgres`（已默认，容器内服务名） |
| 用户名 | `DB_USER`（默认 `tkho`） |
| 密码 | `DB_PASSWORD` |
| 数据库 | `DB_NAME`（默认 `tkho_booking`） |

## 蓝绿发布流程

1. 当前生产在蓝环境：`.\deploy.ps1 switch blue`（默认）
2. 构建并启动绿环境：`.\deploy.ps1 green`（会停蓝环境容器，数据库与 Redis 保持运行）
3. 验证绿环境直连：`http://localhost:3213`（API）、`http://localhost:3214`（前端）
4. 切换流量：`./switch-nginx-env.sh green`（或 `./deploy.sh switch green`）
5. 回滚：`./switch-nginx-env.sh blue`

> 更稳妥的零停机方式：先 `docker compose ... green up` 不 down 蓝环境，验证后再 `switch`。当前脚本与参考项目一致，绿部署时会 down 蓝应用容器。

## 环境变量说明

`env.production` / `.env` 中需配置：

- `DB_NAME`、`DB_USER`、`DB_PASSWORD` — PostgreSQL
- `REDIS_PASSWORD` — Redis 认证
- `JWT_SECRET` — 必须与开发环境区分，使用强随机串

`DATABASE_URL`、`REDIS_URL` 在 compose 文件中按容器网络自动拼接，无需手写主机名。

## 数据持久化

| 卷名 | 内容 |
|------|------|
| `tkho_postgres_data_volumes` | 数据库文件 |
| `tkho_redis_data_volumes` | Redis AOF |
| `tkho_uploads_data_volumes` | 场馆/展示上传图片 |

清理容器不会删除卷。完全重置需手动：

```powershell
.\deploy.ps1 cleanup
docker volume rm tkho_postgres_data_volumes tkho_redis_data_volumes tkho_uploads_data_volumes
```

## 宿主机级定时备份（Linux）

系统内 Admin「Data Backup」只发 Excel 业务报表，**不能**做整机恢复。生产建议用下面脚本备份 PostgreSQL + 上传卷。

### 手动备份

```bash
cd ~/Documents/TKOH-Online-Booking-System
chmod +x scripts/docker-backup.sh scripts/docker-restore.sh
./scripts/docker-backup.sh
```

默认输出到项目下 `backups/YYYYMMDD_HHMMSS/`，内含：

| 文件 | 说明 |
|------|------|
| `tkho_booking.dump` | `pg_dump -Fc` |
| `tkho_uploads.tgz` | 上传图片卷 |
| `env.backup` | 当时的 `.env`（含密钥，权限 600） |
| `MANIFEST.txt` | 清单 |

可选环境变量：`BACKUP_ROOT`（备份根目录）、`KEEP_DAYS`（默认保留 14 天）、`POSTGRES_CONTAINER`、`UPLOADS_VOLUME`。

### 挂到 crontab（每天自动备份）

```bash
crontab -e
```

加入一行（crontab **不会展开 `~`**，请用绝对路径；用户名为 `deperp` 时如下）：

```cron
15 2 * * * /home/deperp/Documents/TKOH-Online-Booking-System/scripts/docker-backup.sh >> /var/log/tkho-backup.log 2>&1
```

含义：每天 **02:15** 自动备份，日志写入 `/var/log/tkho-backup.log`。

若用户名不是 `deperp`，把 `/home/deperp` 换成 `echo $HOME` 的结果。

建议定期把 `backups/` 拷到另一台机器或对象存储，不要只留在同一台服务器。

### 从备份恢复（覆盖）

```bash
./scripts/docker-restore.sh backups/20260921_021500
```

会提示输入 `yes` 确认；会**覆盖**当前数据库与上传卷。恢复后请确认 `JWT_SECRET` 与备份时一致（可用目录中的 `env.backup`）。

## 前端 API 策略

Docker 构建时 `VITE_USE_SAME_ORIGIN_API=true`（见 `TKHO-frontend/.env.production`），浏览器请求走 Nginx 同源 `/api`，由入口代理到后端。**不需要 ngrok**；外网访问请用服务器公网 IP/域名 + 反向代理或防火墙放行 **3200**（入口 Nginx）。

## 常见问题

### 容器显示 unhealthy（远程服务器）

`unhealthy` 只表示 **Docker 健康检查探针失败**，不等于服务一定不可用。请在**部署机器上**执行：

```bash
# 1. 看健康检查失败原因
docker inspect tkho-booking-nginx --format '{{json .State.Health}}' | jq
docker inspect tkho-booking-frontend-blue --format '{{json .State.Health}}' | jq
docker inspect tkho-booking-backend-blue --format '{{json .State.Health}}' | jq

# 2. 看业务日志（更重要）
docker logs --tail 100 tkho-booking-nginx
docker logs --tail 100 tkho-booking-frontend-blue
docker logs --tail 100 tkho-booking-backend-blue

# 3. 在容器内手动探测（绕过 healthcheck）
docker exec tkho-booking-nginx wget -q -O- http://127.0.0.1/health
docker exec tkho-booking-frontend-blue curl -f http://127.0.0.1/health
docker exec tkho-booking-backend-blue curl -f http://127.0.0.1:3210/api/health
```

常见原因：

| 现象 | 原因 | 处理 |
|------|------|------|
| Nginx unhealthy | 探针用 `localhost` 解析到 IPv6 `::1` | Nginx 使用官方 `nginx:alpine`，探针为 `wget http://127.0.0.1/health`；`force-recreate nginx` 即可 |
| 后端 `health: starting` 很久 | 启动时要跑 `prisma migrate deploy`，超过原 60s 宽限期 | 已把 `start_period` 改为 **120s**；看 `docker logs` 是否迁移失败 |
| 后端反复重启，`Cannot find module '/app/dist/main.js'` | 构建产物在 `dist/src/main.js`，与启动命令不一致 | 已修正 `tsconfig.build.json`；服务器上 **必须 `--build` 重建后端镜像** |
| 后端 `Cannot find module './ev-management.controller'` | 误提交 `tsconfig.build.tsbuildinfo`，Docker 增量编译漏编部分文件 | 已从仓库删除并加入 `.dockerignore`；重建时加 **`--no-cache`** |
| 构建失败 `Failed to parse prisma.config.js` | 误提交 `prisma.config.js` 编译产物，与 Prisma CLI 不兼容 | 已删除；Docker 使用 `--schema=prisma/schema.prisma` |
| Nginx **Restarting** | `nginx.conf` 含 HTTPS，但 `docker/nginx/ssl/` 无 `cert.pem`/`key.pem` | 默认用仅 HTTP 配置；有证书时用 `nginx.*.https.conf` |
| 后端反复重启 | `.env` 中 `DB_PASSWORD` / `REDIS_PASSWORD` 与已有数据卷不一致 | 统一 `.env` 与首次建库时的密码，或删卷重建 |
| Nginx 起不来 | `docker/nginx/ssl` 缺少 `cert.pem`、`key.pem` | 在服务器执行 `deploy.sh` 自动生成，或见 `docker/nginx/ssl/README.md` |

修复配置后，在服务器上重建：

```bash
docker-compose -f docker-compose.nginx.yml up -d --force-recreate nginx
docker-compose -f docker-compose.base.yml -f docker-compose.redis.yml -f docker-compose.blue.yml up -d --build
```

**迁移失败**：确认 PostgreSQL 健康、`DB_PASSWORD` 与 compose 一致，查看日志：

```powershell
docker logs tkho-booking-backend-blue
```

**上传图片 404**：

1. **请通过入口 Nginx 访问**（`http://服务器:3200`），不要只打开前端直连端口 `3212`/`3214`。前端容器会把 `*.jpeg` 当静态文件查找并返回 404，且不会代理 `/api`。
2. 确认卷已挂载且文件存在：
   ```bash
   docker exec tkho-booking-backend-blue ls -la /app/uploads/venues/
   curl -I http://127.0.0.1:3200/api/uploads/venues/你的文件名.jpeg
   ```
3. 数据库里的 `imageUrl` 只在**上传当时**写入磁盘；本地开发上传后只把库迁到服务器、未拷贝 `uploads` 卷，也会 404。需在服务器管理后台重新上传，或把文件复制进卷的 `venues/` 目录。
4. 修改 `.env.production` 或前端代码后需 **重建前端镜像**（`--build`），浏览器强刷缓存后再试。

**seed 报错 `Unknown file extension ".ts"`**：生产镜像不要用 `ts-node` 直接跑 `prisma/seed.ts`。请 `git pull` 重建后端镜像后执行 `docker exec tkho-booking-backend-blue node prisma/seed-dist/seed.js`。未重建前临时：`docker exec tkho-booking-backend-blue sh -c 'cd /app && npx -y ts-node --transpile-only -O "{\"module\":\"commonjs\"}" prisma/seed.ts'`。成功时应看到 `[seed] done`。

**与本地开发共存**：本地后端与 Docker 后端容器内均为 **3210**；若同时跑 Docker 蓝/绿（宿主机 3211/3213），注意勿与本地同端口冲突。Postgres 本地 5432、Docker 25432 可并存。
