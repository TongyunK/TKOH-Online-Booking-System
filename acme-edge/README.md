# ACME Edge（整机共用）

职责：

1. **:80** — Let's Encrypt 校验（`acme-webroot`）
2. **`ssl/`** — 整机**唯一一份**业务 HTTPS 证书（`cert.pem` / `key.pem`）
3. **`scripts/`** — 签发 / 续期（各业务项目不必再各放一份）

各业务 Nginx **不要各自拷贝证书**，改为挂载本目录的 `ssl/`。

## 布局

```text
~/Documents/acme-edge/
  docker-compose.yml
  edge.conf
  acme-webroot/
  ssl/
    cert.pem
    key.pem
  scripts/
    letsencrypt-ip-cert.sh
    letsencrypt-ip-install.sh
```

## 部署 / 同步

```bash
# 从订房仓库同步整份 acme-edge（含 scripts）
cp -a ~/Documents/TKOH-Online-Booking-System/acme-edge/. ~/Documents/acme-edge/
cd ~/Documents/acme-edge
chmod +x scripts/*.sh
docker compose up -d
```

## 订房 Nginx 挂载共用证书

`TKOH-Online-Booking-System/.env`：

```env
ACME_SSL_DIR=/home/proj_deploy/Documents/acme-edge/ssl
```

```bash
cd ~/Documents/TKOH-Online-Booking-System
docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx
```

## 首次放入已有证书（不必重新申请）

```bash
mkdir -p ~/Documents/acme-edge/ssl
cp ~/Documents/TKOH-Online-Booking-System/docker/nginx/ssl/cert.pem ~/Documents/acme-edge/ssl/
cp ~/Documents/TKOH-Online-Booking-System/docker/nginx/ssl/key.pem ~/Documents/acme-edge/ssl/
```

## 续期 crontab（指向 acme-edge 内脚本）

```cron
0 */12 * * * LE_IP=103.68.62.241 LE_RECREATE_NGINX="tkho-booking-nginx leapbud-lease-nginx" /home/proj_deploy/Documents/acme-edge/scripts/letsencrypt-ip-cert.sh renew >> /var/log/le-ip-renew.log 2>&1
```
