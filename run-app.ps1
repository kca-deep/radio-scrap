# Radio Scrap Development Servers Startup Script
# This script starts both frontend (Next.js) and backend (FastAPI) servers

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Starting Radio Scrap Development Servers..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Get script directory and save original location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$originalDir = Get-Location

# Start frontend server in new window
Write-Host "[Frontend] Starting Next.js server in new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; Write-Host 'Frontend Server (Next.js)' -ForegroundColor Yellow; Write-Host 'Running on http://localhost:3000' -ForegroundColor Green; Write-Host ''; npm run dev"

# Wait a moment before starting backend
Start-Sleep -Seconds 2

# Start backend server in current terminal
$backendPath = Join-Path $scriptDir "backend"
Set-Location $backendPath

try {
    if (Test-Path "venv\Scripts\Activate.ps1") {
        & ".\venv\Scripts\Activate.ps1"
        uvicorn app.main:app --reload
    } else {
        Write-Host "Virtual environment not found. Run setup-backend.ps1 first." -ForegroundColor Red
        Read-Host "Press Enter to close"
    }
} finally {
    # Return to original directory
    Set-Location $originalDir
}
