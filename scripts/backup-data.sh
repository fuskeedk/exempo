#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-/home/exempo/data}"
BACKUP_DIR="${BACKUP_DIR:-/home/exempo/backups/data}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d)"
DEST="${BACKUP_DIR}/${STAMP}"

cd /
mkdir -p "$DEST"

copy_db() {
  local src="$1"
  local name
  name="$(basename "$src")"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$src" ".backup '${DEST}/${name}'"
  else
    cp -a "$src" "${DEST}/${name}"
  fi
}

shopt -s nullglob
for db in "$DATA_DIR"/*.db; do
  copy_db "$db"
done
if [[ -d "$DATA_DIR/tenants" ]]; then
  mkdir -p "$DEST/tenants"
  for db in "$DATA_DIR/tenants"/*.db; do
    copy_db "$db"
    mv "${DEST}/$(basename "$db")" "$DEST/tenants/"
  done
fi
for file in platform.json inbox-seen.json; do
  if [[ -f "$DATA_DIR/$file" ]]; then
    cp -a "$DATA_DIR/$file" "$DEST/$file"
  fi
done

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"${KEEP_DAYS}" -exec rm -rf {} +
echo "Backup ${STAMP} skrevet til ${DEST}"
