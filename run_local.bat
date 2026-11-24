@echo off
echo ==========================================================
echo   Libra: Clinical Biomechanics ^& CDSS Platform
echo   AI-Sana Shakarim Solveathon: AI ^& Medicine-2026
echo ==========================================================

echo Starting Python FastAPI backend on http://127.0.0.1:8000...
start "Libra API" cmd /k "python -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000"

echo Starting Next.js frontend on http://127.0.0.1:3000...
cd web
start "Libra Web" cmd /k "npm run dev"
cd ..

echo.
echo ==========================================================
echo   Libra IS LIVE!
echo   Web UI:                      http://127.0.0.1:3000
echo   FastAPI REST Docs (Swagger): http://127.0.0.1:8000/docs
echo ==========================================================
echo Close the opened terminal windows to terminate.
pause
