#!/bin/sh
set -eu

cd /workspace

LOCK_FILE="/workspace/node_modules/.pnpm-lock-hash"
LOCK_DIR="/tmp/veevalve-pnpm-install.lock"

hash_lockfile() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum /workspace/pnpm-lock.yaml | awk '{print $1}'
  else
    shasum -a 256 /workspace/pnpm-lock.yaml | awk '{print $1}'
  fi
}

LOCK_HASH="$(hash_lockfile)"
CURRENT_HASH=""

if [ -f "$LOCK_FILE" ]; then
  CURRENT_HASH="$(cat "$LOCK_FILE" || true)"
fi

if [ ! -d /workspace/node_modules ] || [ "$CURRENT_HASH" != "$LOCK_HASH" ]; then
  until mkdir "$LOCK_DIR" 2>/dev/null; do
    sleep 0.2
  done

  trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT INT TERM

  CURRENT_HASH=""
  if [ -f "$LOCK_FILE" ]; then
    CURRENT_HASH="$(cat "$LOCK_FILE" || true)"
  fi

  if [ ! -d /workspace/node_modules ] || [ "$CURRENT_HASH" != "$LOCK_HASH" ]; then
    echo "Installing workspace dependencies..."
    pnpm install --frozen-lockfile
    mkdir -p /workspace/node_modules
    printf '%s' "$LOCK_HASH" > "$LOCK_FILE"
  fi

  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
  trap - EXIT INT TERM
fi
