# Radio Scrap Development Servers Startup Script
# This script starts both frontend (Next.js) and backend (FastAPI) servers

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Starting Radio Scrap Development Servers..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start backend server in new window
Write-Host "[Backend] Starting FastAPI server..." -ForegroundColor Cyan
$backendPath = Join-Path $scriptDir "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend Server (FastAPI)' -ForegroundColor Yellow; Write-Host 'Running on http://localhost:8000' -ForegroundColor Green; Write-Host ''; if (Test-Path 'venv\Scripts\Activate.ps1') { .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload } else { Write-Host 'Virtual environment not found. Run setup-backend.ps1 first.' -ForegroundColor Red; Read-Host 'Press Enter to close' }"

# Wait a moment before starting frontend
Start-Sleep -Seconds 2

# Start frontend server in new window
Write-Host "[Frontend] Starting Next.js server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; Write-Host 'Frontend Server (Next.js)' -ForegroundColor Yellow; Write-Host 'Running on http://localhost:3000' -ForegroundColor Green; Write-Host ''; npm run dev"

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Servers started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the server windows to stop the servers." -ForegroundColor Yellow
Write-Host ""
