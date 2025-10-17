# Backend Setup Script
# Creates virtual environment and installs dependencies

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Setting up Backend Environment..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

$backendPath = Join-Path $PSScriptRoot "backend"

if (-Not (Test-Path $backendPath)) {
    Write-Host "Error: backend folder not found" -ForegroundColor Red
    exit 1
}

Set-Location $backendPath

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found: $pythonVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: Python not found. Please install Python 3.11+" -ForegroundColor Red
    exit 1
}

# Create virtual environment
if (-Not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv venv
} else {
    Write-Host "Virtual environment already exists" -ForegroundColor Yellow
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Install dependencies
if (Test-Path "requirements.txt") {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    pip install -r requirements.txt
} else {
    Write-Host "Warning: requirements.txt not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Backend setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the backend server, run:" -ForegroundColor Cyan
Write-Host "  .\start-servers.ps1" -ForegroundColor White
Write-Host ""
