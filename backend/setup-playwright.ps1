# Playwright Browser Installation Script
# Run this script after installing Python dependencies

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Installing Playwright Chromium browser..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

# Activate virtual environment if it exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Green
    & ".\venv\Scripts\Activate.ps1"
} else {
    Write-Host "Warning: Virtual environment not found" -ForegroundColor Yellow
    Write-Host "Make sure you have playwright installed: pip install playwright" -ForegroundColor Yellow
    Write-Host ""
}

# Install Playwright browsers
try {
    playwright install chromium
    Write-Host ""
    Write-Host "Playwright Chromium browser installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error installing Playwright browser: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please try manually:" -ForegroundColor Yellow
    Write-Host "  1. Activate venv: .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "  2. Install browser: playwright install chromium" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Gray
Read-Host
