#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/fastapi-backend"
FRONTEND="$ROOT/piriyathu-crm-next"
LOG_DIR="$ROOT/.dev-logs"

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

wait_for_health() {
  local url="$1"
  local attempts="${2:-30}"
  for _ in $(seq 1 "$attempts"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

mkdir -p "$LOG_DIR"

if port_in_use 9000; then
  echo "Port 9000 is already in use. Stop the existing FastAPI process first."
  exit 1
fi

if port_in_use 3000; then
  echo "Port 3000 is already in use. Stop the existing Next.js process first."
  exit 1
fi

echo "Starting FastAPI on http://localhost:9000 ..."
(
  cd "$BACKEND"
  if [[ -f venv/bin/activate ]]; then
    # shellcheck disable=SC1091
    source venv/bin/activate
  fi
  python seed_user.py
  uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
) >"$LOG_DIR/fastapi.log" 2>&1 &
FASTAPI_PID=$!

cleanup() {
  if kill -0 "$FASTAPI_PID" 2>/dev/null; then
    kill "$FASTAPI_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! wait_for_health "http://localhost:9000/health"; then
  echo "FastAPI failed to start. See $LOG_DIR/fastapi.log"
  tail -n 40 "$LOG_DIR/fastapi.log" || true
  exit 1
fi

echo "FastAPI is ready (pid $FASTAPI_PID)."
echo "Starting Next.js on http://localhost:3000 ..."
cd "$FRONTEND"
npm run dev
