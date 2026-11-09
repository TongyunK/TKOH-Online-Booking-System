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
- **整机共用一个**；配置可独立放在 `~/acme-edge`（见仓库 `acme-edge/README.md`），不必放在订房项目里  
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
# 推荐：独立目录（见仓库 acme-edge/README.md）
cd ~/Documents/acme-edge && docker compose up -d
# 或：docker compose -f docker-compose.edge.yml up -d（订房仓库内转发）
# 探测：curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
# 期望 404（说明不是订房站，而是 ACME-only）
```

安全组放行 **TCP 80**。

### 2. 安装 Certbot ≥ 5.4 并签发

脚本在 **`acme-edge/scripts/`**（整机共用，订房项目不再自带同名脚本）。

```bash
# Certbot 需 >= 5.4（apt 的 4.x 没有 --ip-address，会报错）
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version

cd ~/Documents/acme-edge
chmod +x scripts/*.sh

# 建议先 staging
LE_EMAIL=you@example.com LE_IP=103.68.62.241 \
  ./scripts/letsencrypt-ip-cert.sh issue --staging

# 正式
LE_EMAIL=you@example.com LE_IP=103.68.62.241 \
  ./scripts/letsencrypt-ip-cert.sh issue
```

脚本用 **webroot**（不写 standalone），**不停**业务 Nginx。签发后写入 `acme-edge/ssl/`，再 recreate 挂载该目录的各业务 nginx。

业务访问不变：`https://103.68.62.241:3243/`

### 3. 自动续期

```bash
sudo crontab -e
```

```cron
0 */12 * * * LE_IP=103.68.62.241 LE_RECREATE_NGINX="tkho-booking-nginx leapbud-lease-nginx" /home/proj_deploy/Documents/acme-edge/scripts/letsencrypt-ip-cert.sh renew >> /var/log/le-ip-renew.log 2>&1
```

（路径按服务器实际修改。）

### 4. 其他系统共用同一张 IP 证书

各业务 Nginx 挂载同一份 `acme-edge/ssl/`（订房用 `.env` 的 `ACME_SSL_DIR`），勿各自拷贝多份。详见 `acme-edge/README.md`。

### 相关文件

- 仓库 `acme-edge/`（compose、edge.conf、ssl、scripts）
- `docker-compose.edge.yml`（可选：指向独立 acme-edge）
