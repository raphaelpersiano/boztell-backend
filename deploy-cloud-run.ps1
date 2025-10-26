# Deploy to Cloud Run - PowerShell version
# Run this script to deploy latest code to Cloud Run

$ErrorActionPreference = "Stop"

$PROJECT_ID = "your-project-id"  # GANTI dengan Google Cloud Project ID kamu
$SERVICE_NAME = "boztell-backend"
$REGION = "asia-southeast2"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "🚀 Deploying Boztell Backend to Cloud Run..." -ForegroundColor Cyan
Write-Host ""

# Build Docker image
Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

# Push to Container Registry
Write-Host ""
Write-Host "📤 Pushing to Container Registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed!" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run
Write-Host ""
Write-Host "🌟 Deploying to Cloud Run..." -ForegroundColor Yellow

# PENTING: Set semua environment variables di sini
gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_NAME `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --port 8080 `
  --memory 2Gi `
  --cpu 2 `
  --timeout 300 `
  --concurrency 100 `
  --min-instances 0 `
  --max-instances 10 `
  --execution-environment gen2 `
  --set-env-vars "NODE_ENV=production,PORT=8080,HOST=0.0.0.0"

# CATATAN: Environment variables yang sensitive (API keys, database credentials)
# sebaiknya diset manual di Cloud Run Console atau lewat Secret Manager:
# 
# Contoh set env vars manual (ganti dengan nilai sebenarnya):
# --set-env-vars "SUPABASE_URL=https://your-project.supabase.co,SUPABASE_ANON_KEY=your-key,WHATSAPP_TOKEN=your-token"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Run deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green

# Get service URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format "value(status.url)"
Write-Host "🌐 Service URL: $SERVICE_URL" -ForegroundColor Cyan

Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the /send-template endpoint at: $SERVICE_URL/messages/send-template"
Write-Host "2. Check logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit 50"
Write-Host "3. Update environment variables if needed in Cloud Run Console"
