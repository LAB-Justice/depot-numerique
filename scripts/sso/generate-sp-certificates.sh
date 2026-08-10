#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
OUTPUT_DIR="${SSO_SECRET_DIR:-${ROOT_DIR}/.secrets/saml}"

SIGNING_KEY="${OUTPUT_DIR}/sp-signing-private-key.pem"
SIGNING_CERTIFICATE="${OUTPUT_DIR}/sp-signing-certificate.pem"
ENCRYPTION_KEY="${OUTPUT_DIR}/sp-encryption-private-key.pem"
ENCRYPTION_CERTIFICATE="${OUTPUT_DIR}/sp-encryption-certificate.pem"

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate the local SAML certificates." >&2
  exit 1
fi

existing_files=0

for file in "$SIGNING_KEY" "$SIGNING_CERTIFICATE" "$ENCRYPTION_KEY" "$ENCRYPTION_CERTIFICATE"; do
  if [[ -e "$file" ]]; then
    existing_files=$((existing_files + 1))
  fi
done

if [[ "$existing_files" -eq 4 ]]; then
  echo "Local SAML SP certificates already exist in ${OUTPUT_DIR}."
  exit 0
fi

if [[ "$existing_files" -ne 0 ]]; then
  echo "The local SAML secret directory is incomplete. Remove it and regenerate all key pairs." >&2
  exit 1
fi

umask 077
mkdir -p "$OUTPUT_DIR"

openssl req \
  -x509 \
  -newkey rsa:3072 \
  -sha256 \
  -nodes \
  -days 825 \
  -subj "/CN=depot-numerique-local-signing" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature" \
  -keyout "$SIGNING_KEY" \
  -out "$SIGNING_CERTIFICATE" \
  >/dev/null 2>&1

openssl req \
  -x509 \
  -newkey rsa:3072 \
  -sha256 \
  -nodes \
  -days 825 \
  -subj "/CN=depot-numerique-local-encryption" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,keyEncipherment,dataEncipherment" \
  -keyout "$ENCRYPTION_KEY" \
  -out "$ENCRYPTION_CERTIFICATE" \
  >/dev/null 2>&1

chmod 600 "$SIGNING_KEY" "$ENCRYPTION_KEY"
chmod 644 "$SIGNING_CERTIFICATE" "$ENCRYPTION_CERTIFICATE"

echo "Local SAML SP certificates generated in ${OUTPUT_DIR}."
