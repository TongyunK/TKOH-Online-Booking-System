#!/usr/bin/env bash
# 将 Let's Encrypt IP 证书安装到本 acme-edge/ssl，并重启挂载该目录的业务 Nginx。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACME_EDGE_ROOT="${ACME_EDGE_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
LIVE_DIR="${LE_LIVE_DIR:-}"
IP="${LE_IP:-103.68.62.241}"
SSL_DIR="${ACME_SSL_DIR:-${ACME_EDGE_ROOT}/ssl}"
RECREATE_LIST="${LE_RECREATE_NGINX:-tkho-booking-nginx}"

readable_dir() {
  local d="$1"
  if [[ -d "${d}" ]]; then
    return 0
  fi
  if [[ "$(id -u)" -ne 0 ]] && sudo test -d "${d}" 2>/dev/null; then
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
  if readable_dir "/etc/letsencrypt/live/${IP}"; then
    LIVE_DIR="/etc/letsencrypt/live/${IP}"
  else
    if [[ "$(id -u)" -eq 0 ]]; then
      LIVE_DIR="$(ls -1dt /etc/letsencrypt/live/*/ 2>/dev/null | head -n1 || true)"
    else
      LIVE_DIR="$(sudo ls -1dt /etc/letsencrypt/live/*/ 2>/dev/null | head -n1 || true)"
    fi
  fi
fi

LIVE_DIR="${LIVE_DIR%/}"

if [[ -z "${LIVE_DIR}" ]] || ! readable_dir "${LIVE_DIR}"; then
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

echo "Installed shared certs to ${SSL_DIR}"
echo "Mount this directory in every business Nginx as /etc/nginx/ssl"

for cname in ${RECREATE_LIST}; do
  if docker ps -a --format '{{.Names}}' | grep -qx "${cname}"; then
    docker restart "${cname}" || true
    echo "Restarted ${cname}"
  else
    echo "WARN: container not found (skip): ${cname}"
  fi
done
