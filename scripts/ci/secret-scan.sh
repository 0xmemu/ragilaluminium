#!/usr/bin/env bash

set -euo pipefail

readonly GITLEAKS_VERSION='8.28.0'
readonly GITLEAKS_ARCHIVE="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
readonly GITLEAKS_SHA256='a65b5253807a68ac0cafa4414031fd740aeb55f54fb7e55f386acb52e6a840eb'
readonly GITLEAKS_URL="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${GITLEAKS_ARCHIVE}"
readonly REPORT_PATH="${1:-artifacts/gitleaks.sarif}"
readonly TEMP_DIR="$(mktemp -d)"

cleanup() {
    rm -rf -- "${TEMP_DIR}"
}

trap cleanup EXIT

mkdir -p "$(dirname "${REPORT_PATH}")"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
    --output "${TEMP_DIR}/${GITLEAKS_ARCHIVE}" \
    "${GITLEAKS_URL}"

printf '%s  %s\n' "${GITLEAKS_SHA256}" "${TEMP_DIR}/${GITLEAKS_ARCHIVE}" | sha256sum --check --status
tar -xzf "${TEMP_DIR}/${GITLEAKS_ARCHIVE}" -C "${TEMP_DIR}" gitleaks

"${TEMP_DIR}/gitleaks" git \
    --redact=100 \
    --report-format=sarif \
    --report-path="${REPORT_PATH}" \
    .
