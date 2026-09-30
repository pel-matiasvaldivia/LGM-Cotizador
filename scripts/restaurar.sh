#!/bin/sh
# Restaura un backup sobre una base de PRUEBA, para verificar que el respaldo
# sirve. Un backup que nunca se restauró es una suposición, no un respaldo.
#
# Uso (desde el servidor, con el compose levantado):
#   ./scripts/restaurar.sh ./backups/cotizador_20260930_0300.sql.gz
#   ./scripts/restaurar.sh ./backups/cotizador_20260930_0300.sql.gz cotizador
#
# Con un segundo argumento restaura sobre esa base. SIN ese argumento usa
# `cotizador_prueba`, que es lo que conviene para el simulacro: no toca la base
# real. Para una restauración de verdad hay que nombrarla explícitamente.
set -eu

ARCHIVO="${1:-}"
DESTINO="${2:-cotizador_prueba}"

if [ -z "$ARCHIVO" ] || [ ! -f "$ARCHIVO" ]; then
  echo "Uso: $0 <archivo.sql.gz> [base_destino]"
  echo "Backups disponibles:"
  ls -1t ./backups/*.sql.gz 2>/dev/null | head -10 || echo "  (ninguno en ./backups)"
  exit 1
fi

if [ "$DESTINO" = "cotizador" ]; then
  echo "⚠  Vas a restaurar sobre la base REAL (cotizador). Se pierde lo que haya ahora."
  printf "   Escribí 'restaurar' para confirmar: "
  read -r confirma
  [ "$confirma" = "restaurar" ] || { echo "Cancelado."; exit 1; }
fi

echo "[restaurar] verificando el archivo..."
gzip -t "$ARCHIVO" || { echo "El backup está corrupto: no se restaura."; exit 1; }

echo "[restaurar] recreando la base $DESTINO..."
docker compose exec -T db psql -U lgm -d postgres -c "DROP DATABASE IF EXISTS $DESTINO;"
docker compose exec -T db psql -U lgm -d postgres -c "CREATE DATABASE $DESTINO;"

echo "[restaurar] cargando el dump..."
gunzip -c "$ARCHIVO" | docker compose exec -T db psql -q -U lgm -d "$DESTINO"

echo "[restaurar] comprobando que los datos estén..."
docker compose exec -T db psql -U lgm -d "$DESTINO" -c "
  SELECT (SELECT count(*) FROM tenants)   AS empresas,
         (SELECT count(*) FROM usuarios)  AS usuarios,
         (SELECT count(*) FROM proyectos) AS proyectos;"

echo ""
echo "✓ Backup restaurado en la base '$DESTINO'."
[ "$DESTINO" = "cotizador_prueba" ] && echo "  Era un simulacro: la base real no se tocó. Para borrarla:"
[ "$DESTINO" = "cotizador_prueba" ] && echo "  docker compose exec db psql -U lgm -d postgres -c 'DROP DATABASE $DESTINO;'"
exit 0
