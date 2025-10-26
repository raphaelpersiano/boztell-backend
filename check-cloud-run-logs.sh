#!/bin/bash

# Check Cloud Run logs
SERVICE_NAME="boztell-backend"
REGION="asia-southeast2"

echo "📋 Fetching Cloud Run logs for: $SERVICE_NAME"
echo "================================================"

# Get recent logs (last 100 entries)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --limit 100 \
  --format json \
  --project your-project-id \
  --region $REGION

echo ""
echo "================================================"
echo "✅ Logs fetched. Look for errors above."
