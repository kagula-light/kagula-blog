#!/usr/bin/env sh
set -eu

APP_DIR="${KAGURA_APP_DIR:-/opt/kagura-blog}"
COMPOSE_FILE="${APP_DIR}/compose.yml"
ENV_FILE="${APP_DIR}/.env"
STATE_DIR="${APP_DIR}/state"
BACKUP_DIR="${APP_DIR}/backups"
RELEASE="${1:-${APP_RELEASE:-}}"

if [ -z "$RELEASE" ]; then
  echo "usage: deploy-production.sh <git-sha-or-tag>" >&2
  exit 64
fi

if [ ! -f "$COMPOSE_FILE" ] || [ ! -f "$ENV_FILE" ]; then
  echo "missing ${COMPOSE_FILE} or ${ENV_FILE}" >&2
  exit 65
fi

mkdir -p "$STATE_DIR" "$BACKUP_DIR"
cd "$APP_DIR"

PREVIOUS_RELEASE=""
if [ -f "${STATE_DIR}/current-release" ]; then
  PREVIOUS_RELEASE="$(cat "${STATE_DIR}/current-release")"
fi

export APP_RELEASE="$RELEASE"
export WEB_IMAGE="${WEB_IMAGE:-ghcr.io/kagula-light/kagura-blog-web:sha-${RELEASE}}"
export WORKER_IMAGE="${WORKER_IMAGE:-ghcr.io/kagula-light/kagura-blog-worker:sha-${RELEASE}}"

rollback() {
  if [ -n "$PREVIOUS_RELEASE" ]; then
    echo "deployment failed; rolling back to ${PREVIOUS_RELEASE}" >&2
    APP_RELEASE="$PREVIOUS_RELEASE" \
      WEB_IMAGE="ghcr.io/kagula-light/kagura-blog-web:sha-${PREVIOUS_RELEASE}" \
      WORKER_IMAGE="ghcr.io/kagula-light/kagura-blog-worker:sha-${PREVIOUS_RELEASE}" \
      docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d web worker
  fi
}
trap rollback ERR

docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull postgres redis web worker
docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis

if docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps postgres >/dev/null 2>&1; then
  if docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    backup_name="${BACKUP_DIR}/predeploy-${RELEASE}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
    docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -c > "$backup_name"
    echo "wrote backup ${backup_name}"
  fi
fi

docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm migrate
docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d web worker

deadline=$(($(date +%s) + 90))
while [ "$(date +%s)" -lt "$deadline" ]; do
  web_ready="$(docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r=>{const b=await r.json(); process.exit(r.ok && b.status==='ok' && b.service==='web' ? 0 : 1)}).catch(()=>process.exit(1))" >/dev/null 2>&1 && echo ok || echo no)"
  worker_ready="$(docker compose -p kagura-blog -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T worker node -e "fetch('http://127.0.0.1:3001/health/ready').then(async r=>{const b=await r.json(); process.exit(r.ok && b.status==='ok' && b.service==='worker' ? 0 : 1)}).catch(()=>process.exit(1))" >/dev/null 2>&1 && echo ok || echo no)"
  if [ "$web_ready" = "ok" ] && [ "$worker_ready" = "ok" ]; then
    echo "$RELEASE" > "${STATE_DIR}/current-release"
    echo "$PREVIOUS_RELEASE" > "${STATE_DIR}/previous-release"
    trap - ERR
    echo "deployed ${RELEASE}"
    exit 0
  fi
  sleep 3
done

echo "readiness check timed out" >&2
exit 1
