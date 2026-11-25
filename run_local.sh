#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  Libra: Clinical Biomechanics & CDSS Platform"
echo "  AI-Sana Shakarim Solveathon: AI & Medicine-2026"
echo "=========================================================="

cleanup() {
    local rc=$?
    echo ""
    echo "Shutting down Libra local services..."
    kill $(jobs -p) 2>/dev/null || true
    exit "$rc"
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python FastAPI Backend
echo "-> Starting FastAPI Backend on http://127.0.0.1:8000..."
python3 -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000 --log-level warning &
BACKEND_PID=$!

# Wait for backend healthcheck
echo "-> Waiting for Backend readiness..."
BACKEND_READY=0
for i in {1..30}; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "ERROR: FastAPI Backend exited unexpectedly." >&2
        exit 1
    fi
    if curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; then
        echo "✓ Backend ready (SQLite seeded with 29 patients)!"
        BACKEND_READY=1
        break
    fi
    sleep 0.5
done

if [[ $BACKEND_READY -ne 1 ]]; then
    echo "ERROR: FastAPI Backend failed to become ready." >&2
    exit 1
fi

# 2. Start Next.js Frontend
echo "-> Starting Next.js Web UI on http://127.0.0.1:3000..."
cd web
npm run dev -- --port 3000 --hostname 127.0.0.1 &
FRONTEND_PID=$!
cd ..

if ! kill -0 "$BACKEND_PID" 2>/dev/null || ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "ERROR: One or more services failed to start." >&2
    exit 1
fi

echo ""
echo "=========================================================="
echo "  Libra IS LIVE!"
echo "  Web UI:                      http://127.0.0.1:3000"
echo "  FastAPI REST Docs (Swagger): http://127.0.0.1:8000/docs"
echo "=========================================================="
echo "Press Ctrl+C to terminate both servers."
echo ""

wait
