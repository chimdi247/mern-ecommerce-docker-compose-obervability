#!/usr/bin/env bash
# Shared runner used by load-test.sh / stress-test.sh / spike-test.sh.
# Not meant to be run directly.
set -euo pipefail

SCRIPT_NAME="$1" # e.g. load-test.js
shift

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${BACKEND_PORT:-5000}}"

echo "==> Target: ${BASE_URL}"
echo "==> Scenario: ${SCRIPT_NAME}"
echo

if command -v k6 >/dev/null 2>&1; then
  echo "==> Using locally installed k6"
  BASE_URL="$BASE_URL" k6 run "$@" "${TEST_DIR}/scripts/${SCRIPT_NAME}"
else
  echo "==> k6 not found locally, running via Docker (grafana/k6)"
  echo "    (install k6 natively for faster startup: https://grafana.com/docs/k6/latest/set-up/install-k6/)"
  # host.docker.internal lets the k6 container reach the backend's
  # host-published port without needing to know the compose project's
  # internal network name. Works on Docker Desktop (Mac/Windows)
  # out of the box; --add-host makes it work on Linux too (Docker 20.10+).
  DOCKER_BASE_URL="${BASE_URL/localhost/host.docker.internal}"
  docker run --rm -i \
    --add-host=host.docker.internal:host-gateway \
    -e BASE_URL="$DOCKER_BASE_URL" \
    -v "${TEST_DIR}/scripts:/scripts:ro" \
    grafana/k6 run "$@" "/scripts/${SCRIPT_NAME}"
fi
