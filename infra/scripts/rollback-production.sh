#!/usr/bin/env sh
set -eu

APP_DIR="${KAGURA_APP_DIR:-/opt/kagura-blog}"
PROJECT="${KAGURA_COMPOSE_PROJECT:-kagura-blog-prod}"
COMPOSE_FILE="${APP_DIR}/compose.yml"
ENV_FILE="${APP_DIR}/.env"
STATE_DIR="${APP_DIR}/state"
TARGET_RELEASE="${1:-}"

if [ -z "$TARGET_RELEASE" ]; then
  if [ ! -f "${STATE_DIR}/previous-release" ]; then
    echo "usage: rollback-production.sh <git-sha-or-tag>" >&2
    exit 64
  fi
  TARGET_RELEASE="$(cat "${STATE_DIR}/previous-release")"
fi

if [ -z "$TARGET_RELEASE" ]; then
  echo "no previous release recorded" >&2
  exit 65
fi

cd "$APP_DIR"
export APP_RELEASE="$TARGET_RELEASE"
export WEB_IMAGE="ghcr.io/kagula-light/kagura-blog-web:sha-${TARGET_RELEASE}"
export WORKER_IMAGE="ghcr.io/kagula-light/kagura-blog-worker:sha-${TARGET_RELEASE}"

docker compose -p "$PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull web worker
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d web worker
echo "$TARGET_RELEASE" > "${STATE_DIR}/current-release"
echo "rolled back to ${TARGET_RELEASE}"
