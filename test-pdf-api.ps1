#!/usr/bin/env pwsh
# Test bulk PDF generation API

Write-Host "Testing bulk PDF generation API..." -ForegroundColor Cyan

# Step 1: Login to get session cookie
Write-Host "`n[1] Logging in..." -ForegroundColor Yellow
$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"username":"suzuki","password":"password123"}' `
    -SessionVariable session

if ($loginResponse.StatusCode -eq 200) {
    Write-Host "✓ Login successful" -ForegroundColor Green
} else {
    Write-Host "✗ Login failed" -ForegroundColor Red
    exit 1
}

# Step 2: Call bulk PDF generation API
Write-Host "`n[2] Calling bulk PDF generation API..." -ForegroundColor Yellow
$pdfResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/reports/bulk-pdf/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{}' `
    -WebSession $session

Write-Host "Status Code: $($pdfResponse.StatusCode)" -ForegroundColor Cyan
Write-Host "Response Body:" -ForegroundColor Cyan
Write-Host $pdfResponse.Content

# Step 3: Check if PDF file was created
Write-Host "`n[3] Checking for PDF file..." -ForegroundColor Yellow
$pdfFiles = Get-ChildItem -Path "uploads/pdfs" -ErrorAction SilentlyContinue

if ($pdfFiles) {
    Write-Host "✓ PDF files found:" -ForegroundColor Green
    $pdfFiles | ForEach-Object { Write-Host "  - $($_.Name) ($($_.Length) bytes)" }
} else {
    Write-Host "✗ No PDF files found" -ForegroundColor Red
}

# Step 4: Check logs
Write-Host "`n[4] Recent PDF-related logs:" -ForegroundColor Yellow
docker compose logs app --tail=50 | Select-String -Pattern "PDF|bulk-pdf|htmlToPdfFile|getTodayApprovedReports"
