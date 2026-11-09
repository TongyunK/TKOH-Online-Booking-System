# ACME Edge（整机共用）— 从零配置

职责：

1. **:80** — Let's Encrypt 校验（`acme-webroot`）
2. **`ssl/`** — 整机**唯一一份**业务 HTTPS 证书（`cert.pem` / `key.pem`）
3. **`scripts/`** — 签发 / 续期

各业务 Nginx **不要各自拷贝证书**，改为挂载本目录的 `ssl/`。

业务端口不变（订房仍为 `:3200` / `:3243`）；**443 本方案不占用**。

---

## 0. 前置

- 安全组 / 防火墙放行 **TCP 80**（公网能访问该 IP 的 80）
- 本机已装 Docker + Docker Compose
- IP 示例下文用 `103.68.62.241`，按实际替换
- 邮箱示例用 `you@example.com`，按实际替换

---

## 1. 准备目录（首次）

从订房仓库拷贝整份 `acme-edge`（或 git pull 后再拷）：

```bash
mkdir -p ~/Documents/acme-edge
cp -a ~/Documents/TKOH-Online-Booking-System/acme-edge/. ~/Documents/acme-edge/
cd ~/Documents/acme-edge
chmod +x scripts/*.sh
```

目录应类似：

```text
~/Documents/acme-edge/
  docker-compose.yml
  edge.conf
  acme-webroot/
  ssl/
  scripts/
    letsencrypt-ip-cert.sh
    letsencrypt-ip-install.sh
```

---

## 2. 安装 Certbot ≥ 5.4

IP 证书需要 `--ip-address`（apt 的 4.x 没有）：

```bash
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version
# 期望 >= 5.4
```

---

## 3. 启动 ACME Edge（只占 :80）

```bash
cd ~/Documents/acme-edge
docker compose up -d

# 探测：应返回 404（ACME-only，不是业务站）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
```

---

## 4. 申请证书

```bash
cd ~/Documents/acme-edge

# 建议先 staging 试跑（不写正式额度）
LE_EMAIL=you@example.com LE_IP=103.68.62.241 \
  ./scripts/letsencrypt-ip-cert.sh issue --staging

# 正式签发
LE_EMAIL=you@example.com LE_IP=103.68.62.241 \
  ./scripts/letsencrypt-ip-cert.sh issue
```

成功后证书在：

```text
~/Documents/acme-edge/ssl/cert.pem
~/Documents/acme-edge/ssl/key.pem
```

脚本用 webroot，**不会**停业务 Nginx。

---

## 5. 业务 Nginx 挂载共用证书

### 订房（TKOH）

`~/Documents/TKOH-Online-Booking-System/.env`：

```env
ACME_SSL_DIR=/home/proj_deploy/Documents/acme-edge/ssl
```

```bash
cd ~/Documents/TKOH-Online-Booking-System
docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx
```

### 其他系统（如 leapbud）

同样挂载 `/home/proj_deploy/Documents/acme-edge/ssl` → 容器内 `/etc/nginx/ssl`，然后 recreate 其 nginx。

访问示例：`https://103.68.62.241:3243/`

---

## 6. 自动续期（IP 证书约 6 天）

```bash
sudo crontab -e
```

```cron
0 */12 * * * LE_IP=103.68.62.241 LE_RECREATE_NGINX="tkho-booking-nginx leapbud-lease-nginx" /home/proj_deploy/Documents/acme-edge/scripts/letsencrypt-ip-cert.sh renew >> /var/log/le-ip-renew.log 2>&1
```

手动续期一次：

```bash
cd ~/Documents/acme-edge
LE_IP=103.68.62.241 LE_RECREATE_NGINX="tkho-booking-nginx leapbud-lease-nginx" \
  ./scripts/letsencrypt-ip-cert.sh renew
```

---

## 附录：已有证书迁入（不必重新申请）

```bash
mkdir -p ~/Documents/acme-edge/ssl
cp /path/to/existing/cert.pem ~/Documents/acme-edge/ssl/
cp /path/to/existing/key.pem ~/Documents/acme-edge/ssl/
```

然后做第 5 步挂载与 recreate。

---

## 附录：自仓库再次同步

```bash
cp -a ~/Documents/TKOH-Online-Booking-System/acme-edge/. ~/Documents/acme-edge/
chmod +x ~/Documents/acme-edge/scripts/*.sh
cd ~/Documents/acme-edge && docker compose up -d
```
