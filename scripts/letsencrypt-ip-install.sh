#!/usr/bin/env bash
# 将 Let's Encrypt IP 证书安装到 Docker Nginx 使用的 ssl 目录并重建 Nginx。
# 由 certbot --deploy-hook（通常为 root）或本仓库 letsencrypt-ip-cert.sh 调用。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSL_DIR="${ROOT_DIR}/docker/nginx/ssl"
LIVE_DIR="${LE_LIVE_DIR:-}"
IP="${LE_IP:-103.68.62.241}"

# /etc/letsencrypt/live 通常仅 root 可读
readable_dir() {
  local d="$1"
  if [[ -d "${d}" ]]; then
    echo "${d}"
    return 0
  fi
  if [[ "$(id -u)" -ne 0 ]] && sudo test -d "${d}" 2>/dev/null; then
    echo "${d}"
    return 0
  fi
  return 1
}

copy_as_needed() {
  local src="$1"
  local dst="$2"
  local mode="$3"
  if [[ -r "${src}" ]]; then
    cp -f "${src}" "${dst}"
  else
    sudo cp -f "${src}" "${dst}"
  fi
  chmod "${mode}" "${dst}" 2>/dev/null || sudo chmod "${mode}" "${dst}"
}

if [[ -z "${LIVE_DIR}" ]]; then
  if readable_dir "/etc/letsencrypt/live/${IP}" >/dev/null; then
    LIVE_DIR="/etc/letsencrypt/live/${IP}"
  else
    # 回退：取最新 live 目录（可能需 sudo）
    if [[ "$(id -u)" -eq 0 ]]; then
      LIVE_DIR="$(ls -1dt /etc/letsencrypt/live/*/ 2>/dev/null | head -n1 || true)"
    else
      LIVE_DIR="$(sudo ls -1dt /etc/letsencrypt/live/*/ 2>/dev/null | head -n1 || true)"
    fi
  fi
fi

LIVE_DIR="${LIVE_DIR%/}"

if [[ -z "${LIVE_DIR}" ]] || { [[ ! -d "${LIVE_DIR}" ]] && ! sudo test -d "${LIVE_DIR}" 2>/dev/null; }; then
  echo "ERROR: cannot find Let's Encrypt live dir. Set LE_LIVE_DIR=/etc/letsencrypt/live/<ip>"
  exit 1
fi

FULLCHAIN="${LIVE_DIR}/fullchain.pem"
PRIVKEY="${LIVE_DIR}/privkey.pem"

if [[ ! -r "${FULLCHAIN}" ]] && ! sudo test -r "${FULLCHAIN}" 2>/dev/null; then
  echo "ERROR: missing ${FULLCHAIN}"
  exit 1
fi
if [[ ! -r "${PRIVKEY}" ]] && ! sudo test -r "${PRIVKEY}" 2>/dev/null; then
  echo "ERROR: missing ${PRIVKEY}"
  exit 1
fi

mkdir -p "${SSL_DIR}"
umask 077
copy_as_needed "${FULLCHAIN}" "${SSL_DIR}/cert.pem" 644
copy_as_needed "${PRIVKEY}" "${SSL_DIR}/key.pem" 600

echo "Installed certs to ${SSL_DIR}"

# 可选：把同一张 IP 证书同步到其他项目（空格分隔的 ssl 目录绝对路径）
if [[ -n "${LE_EXTRA_SSL_DIRS:-}" ]]; then
  for extra in ${LE_EXTRA_SSL_DIRS}; do
    if [[ -d "${extra}" ]]; then
      cp -f "${SSL_DIR}/cert.pem" "${extra}/cert.pem"
      cp -f "${SSL_DIR}/key.pem" "${extra}/key.pem"
      chmod 644 "${extra}/cert.pem"
      chmod 600 "${extra}/key.pem"
      echo "Also installed certs to ${extra}"
    else
      echo "WARN: LE_EXTRA_SSL_DIRS entry missing: ${extra}"
    fi
  done
fi

cd "${ROOT_DIR}"
if docker compose -f docker-compose.nginx.yml ps --status running 2>/dev/null | grep -q nginx; then
  docker compose -f docker-compose.nginx.yml up -d --force-recreate nginx
  echo "TKOH booking Nginx recreated with new certificate"
else
  echo "TKOH booking Nginx not running; certs installed. Start when ready:"
  echo "  docker compose -f docker-compose.nginx.yml up -d"
fi

if [[ -n "${LE_EXTRA_RECREATE:-}" ]]; then
  for cname in ${LE_EXTRA_RECREATE}; do
    if docker ps -a --format '{{.Names}}' | grep -qx "${cname}"; then
      docker restart "${cname}" || docker start "${cname}" || true
      echo "Restarted ${cname}"
    else
      echo "WARN: container not found: ${cname}"
    fi
  done
fi
