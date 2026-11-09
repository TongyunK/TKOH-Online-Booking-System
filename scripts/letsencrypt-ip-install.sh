#!/usr/bin/env bash
# 将 Let's Encrypt IP 证书安装到 Docker Nginx 使用的 ssl 目录并重建 Nginx。
# 由 certbot --deploy-hook 或本仓库 letsencrypt-ip-cert.sh 调用。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSL_DIR="${ROOT_DIR}/docker/nginx/ssl"
LIVE_DIR="${LE_LIVE_DIR:-}"

if [[ -z "${LIVE_DIR}" ]]; then
  IP="${LE_IP:-103.68.62.241}"
  # Certbot 对 IP 证书的 live 目录名通常是 IP 本身
  if [[ -d "/etc/letsencrypt/live/${IP}" ]]; then
    LIVE_DIR="/etc/letsencrypt/live/${IP}"
  else
    # 回退：取最新的 live 目录
    LIVE_DIR="$(ls -1dt /etc/letsencrypt/live/*/ 2>/dev/null | head -n1 || true)"
  fi
fi

if [[ -z "${LIVE_DIR}" || ! -d "${LIVE_DIR}" ]]; then
  echo "ERROR: cannot find Let's Encrypt live dir. Set LE_LIVE_DIR=/etc/letsencrypt/live/<ip>"
  exit 1
fi

FULLCHAIN="${LIVE_DIR}/fullchain.pem"
PRIVKEY="${LIVE_DIR}/privkey.pem"

if [[ ! -f "${FULLCHAIN}" || ! -f "${PRIVKEY}" ]]; then
  echo "ERROR: missing ${FULLCHAIN} or ${PRIVKEY}"
  exit 1
fi

mkdir -p "${SSL_DIR}"
umask 077
cp -f "${FULLCHAIN}" "${SSL_DIR}/cert.pem"
cp -f "${PRIVKEY}" "${SSL_DIR}/key.pem"
chmod 644 "${SSL_DIR}/cert.pem"
chmod 600 "${SSL_DIR}/key.pem"

echo "Installed certs to ${SSL_DIR}"

cd "${ROOT_DIR}"
if docker compose -f docker-compose.nginx.yml ps --status running 2>/dev/null | grep -q nginx; then
  docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx
  echo "Nginx recreated with new certificate"
else
  echo "Nginx not running; certs installed. Start nginx when ready:"
  echo "  docker compose -f docker-compose.nginx.yml up -d"
fi
