# ACME Edge（整机共用）

与 TKOH / leapbud 等业务目录**分开部署**，只负责宿主机 **:80** 的 Let's Encrypt 校验。

## 推荐位置

```text
/home/proj_deploy/acme-edge/
  docker-compose.yml
  edge.conf
  acme-webroot/
```

可从本仓库拷贝：

```bash
cp -a ~/Documents/TKOH-Online-Booking-System/acme-edge ~/acme-edge
cd ~/acme-edge
docker compose up -d
```

若项目里曾经起过旧 Edge，先停掉避免抢 80：

```bash
cd ~/Documents/TKOH-Online-Booking-System
docker compose -f docker-compose.edge.yml down 2>/dev/null || true
docker rm -f acme-edge tkho-acme-edge 2>/dev/null || true
cd ~/acme-edge && docker compose up -d
```

## 与订房签发脚本配合

签发/续期仍可用订房仓库里的脚本，但指定 Edge 目录：

```bash
export ACME_EDGE_ROOT=/home/proj_deploy/acme-edge
export LE_IP=103.68.62.241

# 签发（一次性）
LE_EMAIL=you@example.com ./Documents/TKOH-Online-Booking-System/scripts/letsencrypt-ip-cert.sh issue

# crontab 续期
0 */12 * * * ACME_EDGE_ROOT=/home/proj_deploy/acme-edge LE_IP=103.68.62.241 /home/proj_deploy/Documents/TKOH-Online-Booking-System/scripts/letsencrypt-ip-cert.sh renew >> /var/log/le-ip-renew.log 2>&1
```

证书仍安装到各业务自己的 `docker/nginx/ssl/`（订房 3243、其他系统各自端口）。
