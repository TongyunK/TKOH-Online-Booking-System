# SSL 证书目录

将证书放在此目录，供 **订房业务 Nginx**（`3243→443`）使用：

| 文件 | 说明 |
|------|------|
| `cert.pem` | 证书（或 fullchain） |
| `key.pem` | 私钥 |

勿将 `*.pem` 提交到 Git（已在 `.gitignore`）。

**访问约定：** 订房系统仍为 `https://<IP>:3243`（及 HTTP `:3200`）。  
宿主机 **:80** 仅给 ACME Edge 做证书校验，**不会**打开订房首页。

---

## A. 开发 / 临时：自签名（浏览器会提示「不安全」）

```bash
cd docker/nginx/ssl
openssl genrsa -out key.pem 2048
openssl req -new -x509 -key key.pem -out cert.pem -days 825 \
  -subj "/CN=103.68.62.241" \
  -addext "subjectAltName=IP:103.68.62.241"

cd ../../..
docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx
```

---

## B. 生产（无域名）：Let's Encrypt IP 短效证书 + ACME Edge

- IP 证书约 **6 天**有效，须自动续期  
- **Edge**（容器名 `acme-edge`）常驻 **:80**，只响应 `/.well-known/acme-challenge/`，其他路径返回 404  
- **整机共用一个**即可；订房 / leapbud 等不要各起一个抢 80  
- **不反代**任何业务；各系统继续用自己的端口  

### 端口一览

| 宿主机端口 | 用途 |
|------------|------|
| **80** | 仅 ACME Edge（证书申请/续期），不是业务站 |
| **443** | **不占用**（本方案不把 443 默认给任何系统） |
| 3200 / **3243** | 订房 TKOH |
| 3400 / 3443 | 其他系统（如 leapbud，按其项目配置） |

### 1. 启动 Edge

```bash
cd ~/Documents/TKOH-Online-Booking-System
docker compose -f docker-compose.edge.yml up -d
# 探测：curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
# 期望 404（说明不是订房站，而是 ACME-only）
```

安全组放行 **TCP 80**。

### 2. 安装 Certbot ≥ 5.4 并签发

```bash
sudo apt update && sudo apt install -y certbot
chmod +x scripts/letsencrypt-ip-cert.sh scripts/letsencrypt-ip-install.sh

# 建议先 staging
LE_EMAIL=you@example.com LE_IP=103.68.62.241 \
  ./scripts/letsencrypt-ip-cert.sh issue --staging

# 正式
LE_EMAIL=you@example.com LE_IP=103.68.62.241 \
  ./scripts/letsencrypt-ip-cert.sh issue
```

脚本用 **webroot**（不写 standalone），**不停**订房 Nginx。签发后拷贝到本目录并 recreate 订房 nginx。

业务访问不变：`https://103.68.62.241:3243/`

### 3. 自动续期

```bash
sudo crontab -e
```

```cron
0 */12 * * * LE_IP=103.68.62.241 /home/proj_deploy/Documents/TKOH-Online-Booking-System/scripts/letsencrypt-ip-cert.sh renew >> /var/log/le-ip-renew.log 2>&1
```

（路径按服务器实际修改。）

### 4. 其他系统共用同一张 IP 证书

证书签的是 IP，可拷贝到其他项目的 ssl 目录后 reload 其 Nginx，例如 leapbud 的 HTTPS 口 `3443`。  
本仓库的 `letsencrypt-ip-install.sh` 默认只更新 **本仓库** `docker/nginx/ssl/`；其他系统请自行拷贝或扩展 hook。

### 相关文件

- `docker-compose.edge.yml` / `docker/nginx/edge.conf` / `docker/nginx/acme-webroot/`
- `scripts/letsencrypt-ip-cert.sh` / `scripts/letsencrypt-ip-install.sh`
