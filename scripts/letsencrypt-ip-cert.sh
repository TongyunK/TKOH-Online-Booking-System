#!/usr/bin/env bash
# Let's Encrypt：公网 IP 短效证书（约 6 天）签发 / 续期（webroot），并安装到 docker/nginx/ssl/
#
# 架构：
#   - docker-compose.edge.yml 的 acme-edge 常驻宿主机 :80（仅 ACME，不反代业务）
#   - 订房 HTTPS 仍为 https://IP:3243 ；其他系统仍走各自端口
#
# 前提：
#   1) 云安全组放行 TCP 80
#   2) Certbot >= 5.4
#   3) 已启动 edge：docker compose -f docker-compose.edge.yml up -d
#
# 用法：
#   LE_EMAIL=you@example.com LE_IP=103.68.62.241 ./scripts/letsencrypt-ip-cert.sh issue
#   LE_IP=103.68.62.241 ./scripts/letsencrypt-ip-cert.sh renew
#   LE_IP=103.68.62.241 ./scripts/letsencrypt-ip-cert.sh install-only
#   ... issue --staging
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_HOOK="${ROOT_DIR}/scripts/letsencrypt-ip-install.sh"
WEBROOT="${ROOT_DIR}/docker/nginx/acme-webroot"
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
  local ver_line
  ver_line="$(certbot --version 2>&1 | head -n1 || true)"
  echo "Using ${ver_line}"

  # IP 证书需要 --ip-address（Certbot >= 5.3/5.4）；apt 常见 4.x 不够
  if ! certbot --help all 2>/dev/null | grep -q -- '--ip-address'; then
    echo "ERROR: this Certbot does not support --ip-address (need >= 5.4 for LE IP certs)."
    echo "Your version cannot issue Let's Encrypt certificates for bare IPs."
    print_certbot_upgrade_help
    exit 1
  fi
}

print_certbot_upgrade_help() {
  cat <<'EOF'
Upgrade options (pick one):

  # Recommended on Ubuntu/Debian — Snap is usually newest
  sudo snap install --classic certbot
  sudo ln -sf /snap/bin/certbot /usr/bin/certbot
  certbot --version    # expect 5.4+

  # Or pip (in a venv)
  # python3 -m pip install --upgrade certbot

Then re-run:
  LE_EMAIL=... LE_IP=103.68.62.241 ./scripts/letsencrypt-ip-cert.sh issue
EOF
}
ensure_edge() {
  mkdir -p "${WEBROOT}"
  cd "${ROOT_DIR}"
  if ! docker compose -f docker-compose.edge.yml ps --status running 2>/dev/null | grep -q acme-edge; then
    echo "Starting ACME edge on :80 (no business reverse-proxy)..."
    docker compose -f docker-compose.edge.yml up -d
  fi
  # certbot 以 root 写 challenge 文件；保证 webroot 可写
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

  # webroot：不中断订房 Nginx（3243）
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
    echo "Issuing short-lived IP cert for ${LE_IP} via webroot (edge :80) ..."
    if run_certbot_issue; then
      LE_IP="${LE_IP}" bash "${INSTALL_HOOK}" || true
    else
      exit 1
    fi
    echo "Done. Business URL unchanged: https://${LE_IP}:3243/"
    echo "Port 80 is ACME-only (not the booking site)."
    ;;
  renew)
    need_certbot
    echo "Renewing short-lived IP certs (if due) ..."
    run_certbot_renew
    echo "Renew finished."
    ;;
  install-only)
    LE_IP="${LE_IP}" bash "${INSTALL_HOOK}"
    ;;
  ensure-edge)
    ensure_edge
    echo "Edge is up on :80"
    ;;
  *)
    echo "Usage:"
    echo "  docker compose -f docker-compose.edge.yml up -d"
    echo "  LE_EMAIL=you@example.com LE_IP=103.68.62.241 $0 issue [--staging]"
    echo "  LE_IP=103.68.62.241 $0 renew [--staging]"
    echo "  LE_IP=103.68.62.241 $0 install-only"
    echo "  $0 ensure-edge"
    exit 1
    ;;
esac
