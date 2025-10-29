#!/usr/bin/env bash
set -e

: "${PRISMA_MIGRATE:=true}"

if [ -f "prisma/schema.prisma" ]; then
  npx prisma generate || true
  if [ "$PRISMA_MIGRATE" = "true" ]; then
    npx prisma migrate deploy || true
  fi
fi

exec node dist/main.js
