#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

STAMP_DIR=".prisma"
STAMP_FILE="$STAMP_DIR/schema.hash"

if command -v sha256sum >/dev/null 2>&1; then
  SCHEMA_HASH="$(sha256sum prisma/schema.prisma | awk '{print $1}')"
else
  SCHEMA_HASH="$(shasum -a 256 prisma/schema.prisma | awk '{print $1}')"
fi

NEEDS_GENERATE=0

if [ ! -d node_modules/@prisma/client ]; then
  NEEDS_GENERATE=1
elif [ ! -f "$STAMP_FILE" ]; then
  NEEDS_GENERATE=1
elif [ "$(cat "$STAMP_FILE" || true)" != "$SCHEMA_HASH" ]; then
  NEEDS_GENERATE=1
fi

if [ "$NEEDS_GENERATE" -eq 1 ]; then
  echo "Generating Prisma client..."
  XDG_CACHE_HOME=../../.cache prisma generate
  mkdir -p "$STAMP_DIR"
  printf '%s' "$SCHEMA_HASH" > "$STAMP_FILE"
fi
