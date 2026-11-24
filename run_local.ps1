# Libra PowerShell Local Runner for Windows
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Libra: Clinical Biomechanics & CDSS Platform" -ForegroundColor Cyan
Write-Host "  AI-Sana Shakarim Solveathon: AI & Medicine-2026" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Start Backend
Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backend = Start-Process python -ArgumentList "-m uvicorn src.api.app:app --host 127.0.0.1 --port 8000" -PassThru

# Start Frontend
Write-Host "Starting Next.js Web UI on http://127.0.0.1:3000..." -ForegroundColor Yellow
Set-Location web
$frontend = Start-Process npm -ArgumentList "run dev" -PassThru
Set-Location ..

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Libra IS LIVE!" -ForegroundColor Green
Write-Host "  Web UI:                      http://127.0.0.1:3000" -ForegroundColor White
Write-Host "  FastAPI REST Docs (Swagger): http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Press Enter to stop both servers."
Read-Host

Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
Write-Host "Services stopped." -ForegroundColor Gray
