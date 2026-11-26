#!/bin/sh
# Backup de la base, con copia fuera del servidor.
#
# Un backup que vive en el mismo servidor que la base no es un backup: si se
# pierde la máquina, se pierden los dos. Por eso acá pasan tres cosas:
#   1. se genera el dump comprimido,
#   2. se verifica que el .gz esté sano (un dump corrupto se detecta ahora, no
#      el día que hay que restaurar),
#   3. se copia al destino remoto si hay uno configurado.
#
# Sin destino remoto configurado el backup local se hace igual, pero el log lo
# avisa en cada corrida: es una decisión, no un olvido.
#
# Variables (todas opcionales menos las de Postgres, que vienen del compose):
#   BACKUP_RETENCION_DIAS   días que se conservan localmente (default 14)
#   BACKUP_CADA_SEGUNDOS    cada cuánto corre (default 86400)
#   BACKUP_REMOTO           destino rclone, ej: "b2:mi-bucket/cotizador"
#   RCLONE_CONFIG_*         credenciales del remoto (formato de rclone por env)
set -eu

DIR=/backups
RETENCION="${BACKUP_RETENCION_DIAS:-14}"
INTERVALO="${BACKUP_CADA_SEGUNDOS:-86400}"

log() { echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# rclone se instala una sola vez, y sólo si hace falta. Si la instalación falla
# (sin red, por ejemplo) el backup local sigue corriendo igual.
preparar_remoto() {
  [ -z "${BACKUP_REMOTO:-}" ] && return 1
  command -v rclone >/dev/null 2>&1 && return 0

  log "instalando rclone para copiar a ${BACKUP_REMOTO}..."
  if apk add --no-cache rclone >/dev/null 2>&1; then
    return 0
  fi
  log "ERROR: no se pudo instalar rclone; esta vuelta queda sólo la copia local"
  return 1
}

respaldar() {
  archivo="$DIR/cotizador_$(date +%Y%m%d_%H%M).sql.gz"

  if ! pg_dump -h "${PGHOST:-db}" -U "${PGUSER:-lgm}" "${PGDATABASE:-cotizador}" | gzip > "$archivo"; then
    log "ERROR: falló pg_dump; no se genera backup en esta vuelta"
    rm -f "$archivo"
    return 1
  fi

  # Un .gz que no se puede descomprimir no sirve de nada: mejor enterarse acá.
  if ! gzip -t "$archivo"; then
    log "ERROR: el dump salió corrupto, se descarta ($archivo)"
    rm -f "$archivo"
    return 1
  fi

  tamano=$(du -h "$archivo" | cut -f1)
  log "dump ok: $(basename "$archivo") ($tamano)"

  if preparar_remoto; then
    if rclone copy "$archivo" "$BACKUP_REMOTO" 2>&1 | sed 's/^/[backup][rclone] /'; then
      log "copiado a $BACKUP_REMOTO"
      # La retención remota la maneja rclone contra el mismo criterio local.
      rclone delete --min-age "${RETENCION}d" "$BACKUP_REMOTO" 2>&1 | sed 's/^/[backup][rclone] /' || true
    else
      log "ERROR: no se pudo copiar a $BACKUP_REMOTO (el backup local quedó hecho)"
    fi
  else
    log "AVISO: sin BACKUP_REMOTO configurado, el backup vive sólo en este servidor"
  fi

  # Rotación local
  find "$DIR" -name '*.sql.gz' -mtime "+$RETENCION" -delete
  log "backups locales: $(find "$DIR" -name '*.sql.gz' | wc -l) archivo(s)"
}

log "servicio de backup iniciado (cada ${INTERVALO}s, retención ${RETENCION} días)"
while true; do
  respaldar || true
  sleep "$INTERVALO"
done
