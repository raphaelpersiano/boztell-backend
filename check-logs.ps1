# Check Cloud Run Logs - PowerShell version
# Run this to see what's happening in Cloud Run

$PROJECT_ID = "your-project-id"  # GANTI dengan Google Cloud Project ID
$SERVICE_NAME = "boztell-backend"
$REGION = "asia-southeast2"

Write-Host "📋 Fetching Cloud Run logs for: $SERVICE_NAME" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Gray
Write-Host ""

# Get recent logs (last 50 entries)
Write-Host "🔍 Fetching last 50 log entries..." -ForegroundColor Yellow
Write-Host ""

gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" `
  --limit 50 `
  --format json `
  --project $PROJECT_ID

Write-Host ""
Write-Host "================================================" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "- Look for ERROR or ❌ in the logs above"
Write-Host "- Check if environment variables are set correctly"
Write-Host "- Verify database connection is working"
Write-Host ""
Write-Host "🔗 View in Console: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/logs?project=$PROJECT_ID"
