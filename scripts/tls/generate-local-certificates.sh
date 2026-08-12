#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
OUTPUT_DIR="${TLS_SECRET_DIR:-${ROOT_DIR}/.secrets/traefik}"

PUBLIC_HOST="${PUBLIC_HOST:-depot-numerique.localhost}"
IDP_PUBLIC_HOST="${IDP_PUBLIC_HOST:-idp.depot-numerique.localhost}"

CERTIFICATE="${OUTPUT_DIR}/local-cert.pem"
PRIVATE_KEY="${OUTPUT_DIR}/local-key.pem"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required to generate the local HTTPS certificate." >&2
  echo "Install mkcert, run 'mkcert -install', then retry." >&2
  exit 1
fi

existing_files=0

for file in "$CERTIFICATE" "$PRIVATE_KEY"; do
  if [[ -e "$file" ]]; then
    existing_files=$((existing_files + 1))
  fi
done

if [[ "$existing_files" -eq 2 ]]; then
  echo "The local HTTPS certificate already exists in ${OUTPUT_DIR}."
  exit 0
fi

if [[ "$existing_files" -ne 0 ]]; then
  echo "The local HTTPS secret directory is incomplete." >&2
  echo "Remove both local TLS files before regenerating the certificate." >&2
  exit 1
fi

umask 077
mkdir -p "$OUTPUT_DIR"

mkcert \
  -cert-file "$CERTIFICATE" \
  -key-file "$PRIVATE_KEY" \
  "$PUBLIC_HOST" \
  "$IDP_PUBLIC_HOST"

chmod 600 "$PRIVATE_KEY"
chmod 644 "$CERTIFICATE"

echo "Local HTTPS certificate generated in ${OUTPUT_DIR}."
echo "Covered hosts: ${PUBLIC_HOST}, ${IDP_PUBLIC_HOST}."
