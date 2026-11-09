#!/usr/bin/env bash
# Let's Encrypt IP 短效证书签发/续期（与业务项目无关，放在 acme-edge 下）
#
# 用法：
#   cd ~/Documents/acme-edge
#   LE_EMAIL=you@example.com LE_IP=103.68.62.241 ./scripts/letsencrypt-ip-cert.sh issue
#   LE_IP=103.68.62.241 LE_RECREATE_NGINX="tkho-booking-nginx leapbud-lease-nginx" ./scripts/letsencrypt-ip-cert.sh renew
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACME_EDGE_ROOT="${ACME_EDGE_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
INSTALL_HOOK="${SCRIPT_DIR}/letsencrypt-ip-install.sh"
EDGE_COMPOSE="${ACME_EDGE_ROOT}/docker-compose.yml"
WEBROOT="${ACME_EDGE_ROOT}/acme-webroot"
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
  if [[ ! -f "${EDGE_COMPOSE}" ]]; then
    echo "ERROR: missing ${EDGE_COMPOSE}"
    exit 1
  fi
  mkdir -p "${WEBROOT}"
  echo "ACME_EDGE_ROOT=${ACME_EDGE_ROOT}"
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
    if [[ ! -s "${ACME_EDGE_ROOT}/ssl/cert.pem" ]]; then
      echo "Deploy-hook did not leave cert.pem; installing now..."
      ACME_EDGE_ROOT="${ACME_EDGE_ROOT}" LE_IP="${LE_IP}" \
        LE_LIVE_DIR="/etc/letsencrypt/live/${LE_IP}" bash "${INSTALL_HOOK}"
    fi
    echo "Done. Shared certs: ${ACME_EDGE_ROOT}/ssl/"
    echo "Business still uses its own ports (e.g. https://${LE_IP}:3243/)."
    ;;
  renew)
    need_certbot
    echo "Renewing short-lived IP certs (if due) ..."
    run_certbot_renew
    echo "Renew finished."
    ;;
  install-only)
    ACME_EDGE_ROOT="${ACME_EDGE_ROOT}" LE_IP="${LE_IP}" \
      LE_LIVE_DIR="/etc/letsencrypt/live/${LE_IP}" bash "${INSTALL_HOOK}"
    ;;
  ensure-edge)
    ensure_edge
    echo "Edge is up on :80"
    ;;
  *)
    echo "Usage:"
    echo "  LE_EMAIL=... LE_IP=... $0 issue [--staging]"
    echo "  LE_IP=... LE_RECREATE_NGINX=\"tkho-booking-nginx leapbud-lease-nginx\" $0 renew"
    echo "  $0 install-only | ensure-edge"
    exit 1
    ;;
esac
