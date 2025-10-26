# Test Cloud Run endpoint
# Quick test to see if send-template works

$CLOUD_RUN_URL = "https://your-service-url.run.app"  # GANTI dengan Cloud Run URL kamu

Write-Host "🧪 Testing /send-template endpoint..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    to = "fffestPhoneNumberff"
    templateName = "halo_kak"
    languageCode = "en_US"
    user_id = "f99b87bd-e010-41f1-a566-f4d0778d1ed9"
    room_id = $null  # Test with null room_id (should create new room)
} | ConvertTo-Json

Write-Host "📤 Request Body:" -ForegroundColor Yellow
Write-Host $body -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "⏳ Sending request..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod `
        -Uri "$CLOUD_RUN_URL/messages/send-template" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30

    Write-Host ""
    Write-Host "✅ Success! Response:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray

} catch {
    Write-Host ""
    Write-Host "❌ Request Failed!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get error response body
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "💡 Next steps if failed:" -ForegroundColor Yellow
Write-Host "1. Check Cloud Run logs: .\check-logs.ps1"
Write-Host "2. Verify environment variables in Cloud Run Console"
Write-Host "3. Test locally first: npm run dev (then test http://localhost:8080)"
