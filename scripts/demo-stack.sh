#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
COMPOSE_FILE="$PROJECT_DIR/compose.mock-bi.yaml"
ENV_FILE="$PROJECT_DIR/.env.demo"
ACTION=${1:-status}

case "$ACTION" in
  up)
    if [ ! -f "$ENV_FILE" ]; then
      echo "缺少.env.demo，请复制.env.demo.example并填写DIFY_API_KEY" >&2
      exit 1
    fi
    if ! grep -Eq '^DIFY_API_KEY=.+$' "$ENV_FILE"; then
      echo ".env.demo中的DIFY_API_KEY不能为空" >&2
      exit 1
    fi
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build mock-bi
    ;;
  down)
    docker compose -f "$COMPOSE_FILE" stop mock-bi
    docker compose -f "$COMPOSE_FILE" rm -f mock-bi
    ;;
  status)
    docker compose -f "$COMPOSE_FILE" ps mock-bi
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs --tail=120 mock-bi
    ;;
  *)
    echo "用法: $0 up|down|status|logs" >&2
    exit 2
    ;;
esac
