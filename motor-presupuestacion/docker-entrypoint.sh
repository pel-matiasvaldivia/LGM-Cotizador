#!/bin/sh
set -e

echo "[entrypoint] aplicando migraciones..."
node scripts/migrate.mjs

echo "[entrypoint] iniciando servidor..."
exec node server.js
