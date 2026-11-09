#!/usr/bin/env bash
# Let's Encrypt：公网 IP 短效证书（约 6 天）签发 / 续期（webroot），并安装到本仓库 docker/nginx/ssl/
#
# ACME Edge 可独立部署（推荐）：
#   export ACME_EDGE_ROOT=$HOME/acme-edge
# 未设置时自动查找：$HOME/acme-edge → 本仓库/acme-edge → 本仓库旧路径 docker-compose.edge.yml
#
# 用法：
#   LE_EMAIL=you@example.com LE_IP=103.68.62.241 ./scripts/letsencrypt-ip-cert.sh issue
#   ACME_EDGE_ROOT=$HOME/acme-edge LE_IP=... ./scripts/letsencrypt-ip-cert.sh renew
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_HOOK="${ROOT_DIR}/scripts/letsencrypt-ip-install.sh"
LE_IP="${LE_IP:-103.68.62.241}"
LE_EMAIL="${LE_EMAIL:-}"
STAGING=0
ACTION="${1:-}"
shift || true

for arg in "$@"; do
  case "${arg}" in
    --staging) STAGING=1 ;;
    *) echo "Unknown arg: ${arg}"; exit 1 ;;
  esac
done

resolve_acme_edge_root() {
  if [[ -n "${ACME_EDGE_ROOT:-}" ]]; then
    echo "${ACME_EDGE_ROOT}"
    return
  fi
  if [[ -f "${HOME}/acme-edge/docker-compose.yml" ]]; then
    echo "${HOME}/acme-edge"
    return
  fi
  if [[ -f "${ROOT_DIR}/acme-edge/docker-compose.yml" ]]; then
    echo "${ROOT_DIR}/acme-edge"
    return
  fi
  # 兼容旧布局
  echo "${ROOT_DIR}"
}

ACME_EDGE_ROOT="$(resolve_acme_edge_root)"
if [[ -f "${ACME_EDGE_ROOT}/docker-compose.yml" && -d "${ACME_EDGE_ROOT}/acme-webroot" ]]; then
  EDGE_COMPOSE="${ACME_EDGE_ROOT}/docker-compose.yml"
  WEBROOT="${ACME_EDGE_ROOT}/acme-webroot"
elif [[ -f "${ACME_EDGE_ROOT}/docker-compose.edge.yml" ]]; then
  EDGE_COMPOSE="${ACME_EDGE_ROOT}/docker-compose.edge.yml"
  WEBROOT="${ACME_EDGE_ROOT}/docker/nginx/acme-webroot"
else
  EDGE_COMPOSE="${ROOT_DIR}/docker-compose.edge.yml"
  WEBROOT="${ROOT_DIR}/docker/nginx/acme-webroot"
  ACME_EDGE_ROOT="${ROOT_DIR}"
fi

need_certbot() {
  if ! command -v certbot >/dev/null 2>&1; then
    echo "ERROR: certbot not found. Install Certbot >= 5.4 first."
    print_certbot_upgrade_help
    exit 1
  fi
  echo "Using $(certbot --version 2>&1 | head -n1 || true)"
  if ! certbot --help all 2>/dev/null | grep -q -- '--ip-address'; then
    echo "ERROR: this Certbot does not support --ip-address (need >= 5.4)."
    print_certbot_upgrade_help
    exit 1
  fi
}

print_certbot_upgrade_help() {
  cat <<'EOF'
Upgrade (recommended):
  sudo snap install --classic certbot
  sudo ln -sf /snap/bin/certbot /usr/bin/certbot
  certbot --version
EOF
}

ensure_edge() {
  mkdir -p "${WEBROOT}"
  echo "ACME_EDGE_ROOT=${ACME_EDGE_ROOT}"
  echo "WEBROOT=${WEBROOT}"
  cd "${ACME_EDGE_ROOT}"
  if ! docker compose -f "${EDGE_COMPOSE}" ps --status running 2>/dev/null | grep -q acme-edge; then
    echo "Starting ACME edge on :80 ..."
    docker compose -f "${EDGE_COMPOSE}" up -d
  fi
  sudo mkdir -p "${WEBROOT}/.well-known/acme-challenge"
  sudo chmod -R a+rX "${WEBROOT}" || true
}

run_certbot_issue() {
  if [[ -z "${LE_EMAIL}" ]]; then
    echo "ERROR: set LE_EMAIL=your@email.com"
    exit 1
  fi
  local extra=()
  if [[ "${STAGING}" -eq 1 ]]; then
    extra+=(--staging)
    echo "NOTE: --staging (test only)"
  fi
  sudo certbot certonly \
    --non-interactive \
    --agree-tos \
    --email "${LE_EMAIL}" \
    --preferred-profile shortlived \
    --webroot \
    --webroot-path "${WEBROOT}" \
    --ip-address "${LE_IP}" \
    --deploy-hook "${INSTALL_HOOK}" \
    "${extra[@]}"
}

run_certbot_renew() {
  local extra=()
  if [[ "${STAGING}" -eq 1 ]]; then
    extra+=(--staging)
  fi
  ensure_edge
  sudo certbot renew \
    --preferred-profile shortlived \
    --deploy-hook "${INSTALL_HOOK}" \
    "${extra[@]}"
}

chmod +x "${INSTALL_HOOK}" 2>/dev/null || true

case "${ACTION}" in
  issue)
    need_certbot
    ensure_edge
    echo "Issuing short-lived IP cert for ${LE_IP} via webroot ..."
    if ! run_certbot_issue; then
      exit 1
    fi
    if [[ ! -s "${ROOT_DIR}/docker/nginx/ssl/cert.pem" ]]; then
      echo "Deploy-hook did not leave cert.pem; installing now..."
      LE_IP="${LE_IP}" LE_LIVE_DIR="/etc/letsencrypt/live/${LE_IP}" bash "${INSTALL_HOOK}"
    fi
    echo "Done. Business URL: https://${LE_IP}:3243/"
    ;;
  renew)
    need_certbot
    echo "Renewing short-lived IP certs (if due) ..."
    run_certbot_renew
    echo "Renew finished."
    ;;
  install-only)
    LE_IP="${LE_IP}" LE_LIVE_DIR="/etc/letsencrypt/live/${LE_IP}" bash "${INSTALL_HOOK}"
    ;;
  ensure-edge)
    ensure_edge
    echo "Edge is up on :80"
    ;;
  *)
    echo "Usage:"
    echo "  ACME_EDGE_ROOT=\$HOME/acme-edge LE_EMAIL=... LE_IP=... $0 issue"
    echo "  ACME_EDGE_ROOT=\$HOME/acme-edge LE_IP=... $0 renew"
    echo "  $0 install-only | ensure-edge"
    exit 1
    ;;
esac
