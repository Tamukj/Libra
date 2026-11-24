#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  Libra: Clinical Biomechanics & CDSS Platform"
echo "  AI-Sana Shakarim Solveathon: AI & Medicine-2026"
echo "=========================================================="

cleanup() {
    echo ""
    echo "Shutting down Libra local services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python FastAPI Backend
echo "-> Starting FastAPI Backend on http://127.0.0.1:8000..."
python3 -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000 --log-level warning &
BACKEND_PID=$!

# Wait for backend healthcheck
echo "-> Waiting for Backend readiness..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; then
        echo "✓ Backend ready (SQLite seeded with 29 patients)!"
        break
    fi
    sleep 0.5
done

# 2. Start Next.js Frontend
echo "-> Starting Next.js Web UI on http://127.0.0.1:3000..."
cd web
npm run dev -- --port 3000 --hostname 127.0.0.1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================================="
echo "  Libra IS LIVE!"
echo "  Web UI:                      http://127.0.0.1:3000"
echo "  FastAPI REST Docs (Swagger): http://127.0.0.1:8000/docs"
echo "=========================================================="
echo "Press Ctrl+C to terminate both servers."
echo ""

wait
