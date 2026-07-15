#!/usr/bin/env sh
set -eu

APP_DIR="${KAGURA_APP_DIR:-/opt/kagura-blog}"
PROJECT="${KAGURA_COMPOSE_PROJECT:-kagura-blog-prod}"
COMPOSE_FILE="${APP_DIR}/compose.yml"
ENV_FILE="${APP_DIR}/.env"
BACKUP_DIR="${APP_DIR}/backups"

mkdir -p "$BACKUP_DIR"
umask 077
cd "$APP_DIR"

backup_name="${BACKUP_DIR}/manual-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -c > "$backup_name"
echo "wrote backup ${backup_name}"
