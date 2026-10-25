#!/bin/zsh
set -e

PROJECT_DIR="${0:A:h}"
NODE_BIN="/Users/liuxiaohua/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
RUNTIME_DIR="${TMPDIR:-/tmp}/fmcg-ai-demo"
mkdir -p "$RUNTIME_DIR"
cd "$PROJECT_DIR"

if ! curl -fsS --max-time 2 http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
  if ! curl -fsS --max-time 2 http://localhost/ >/dev/null 2>&1; then
    open /Users/liuxiaohua/Applications/Dify.app >/dev/null 2>&1 || open -a Docker >/dev/null 2>&1 || true
    for i in {1..90}; do
      curl -fsS --max-time 2 http://localhost/ >/dev/null 2>&1 && break
      sleep 2
    done
  fi
  set -a
  source .env.demo
  set +a
  HOST=127.0.0.1 PORT=8787 DIFY_BASE_URL=http://localhost/v1 STATE_FILE="$RUNTIME_DIR/state.json" \
    nohup "$NODE_BIN" server/start.mjs >"$RUNTIME_DIR/gateway.log" 2>&1 &
  for i in {1..30}; do
    curl -fsS --max-time 1 http://127.0.0.1:8787/api/health >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! curl -fsS --max-time 2 http://127.0.0.1:58044/index.html >/dev/null 2>&1; then
  PREVIEW_PORT=58044 nohup "$NODE_BIN" scripts/static-preview.mjs >"$RUNTIME_DIR/preview.log" 2>&1 &
  for i in {1..20}; do
    curl -fsS --max-time 1 http://127.0.0.1:58044/index.html >/dev/null 2>&1 && break
    sleep 1
  done
fi

open "http://127.0.0.1:58044/index.html?v=20261019-unified-ai"
