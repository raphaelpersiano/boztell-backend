#!/bin/bash

# Deploy to Cloud Run script
set -e

PROJECT_ID="your-project-id"
SERVICE_NAME="boztell-backend"
REGION="asia-southeast2"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying Boztell Backend to Cloud Run..."

# Build and push image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .

echo "📤 Pushing to Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "🌟 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 100 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,PORT=8080,HOST=0.0.0.0 \
  --execution-environment gen2

echo "✅ Deployment complete!"
echo "🌐 Service URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"
