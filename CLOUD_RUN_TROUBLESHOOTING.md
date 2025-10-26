# Cloud Run Troubleshooting Guide 🔧

## Problem: Works in Postman but NOT in Cloud Run

### Quick Diagnosis Steps:

#### 1️⃣ Check if Latest Code is Deployed
```powershell
# Check current deployment
gcloud run services describe boztell-backend --region asia-southeast2

# Check last deployment time
gcloud run revisions list --service boztell-backend --region asia-southeast2
```

**Solution:** Deploy latest code
```powershell
.\deploy-cloud-run.ps1
```

---

#### 2️⃣ Check Environment Variables

**Problem:** Postman menggunakan localhost environment variables, tapi Cloud Run pakai environment variables yang berbeda.

**Check Current Env Vars:**
```powershell
gcloud run services describe boztell-backend --region asia-southeast2 --format yaml
```

**Required Environment Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service key
- `WHATSAPP_TOKEN` - WhatsApp API token
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp phone number ID
- `WHATSAPP_BUSINESS_ACCOUNT_ID` - WhatsApp business account ID
- `NODE_ENV=production`
- `PORT=8080`

**Set Environment Variables:**
```powershell
gcloud run services update boztell-backend `
  --region asia-southeast2 `
  --set-env-vars "SUPABASE_URL=https://xxx.supabase.co,SUPABASE_ANON_KEY=xxx,WHATSAPP_TOKEN=xxx"
```

---

#### 3️⃣ Check Logs for Errors

```powershell
# Quick check logs
.\check-logs.ps1

# Or manually:
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=boztell-backend" --limit 50
```

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `SUPABASE_URL is not defined` | Missing env var | Set env vars di Cloud Run |
| `Failed to connect to database` | Database timeout | Increase Cloud Run memory/CPU |
| `Invalid phone number` | WhatsApp config salah | Check `WHATSAPP_PHONE_NUMBER_ID` |
| `404 Not Found` | Route tidak ada | Deploy ulang latest code |
| `500 Internal Server Error` | Code error | Check logs untuk stack trace |

---

#### 4️⃣ Test Cloud Run Endpoint

```powershell
# Edit test-cloud-run.ps1 dulu (ganti URL dan data)
.\test-cloud-run.ps1
```

---

#### 5️⃣ Compare Postman vs Cloud Run

**Postman Environment:**
- Uses `http://localhost:8080` or local dev server
- Uses `.env` file variables
- Has direct access to database

**Cloud Run Environment:**
- Uses `https://xxx.run.app` URL
- Uses Cloud Run environment variables
- May have connection timeouts (default 60s)

---

## Step-by-Step Fix for `/send-template` Issue:

### Issue: `room_id` handling berbeda

**Postman (Local):** Works karena code terbaru sudah ada
**Cloud Run:** Tidak works karena code lama (belum deploy)

**Fix:**

1. **Commit & Push** (sudah dilakukan ✅):
   ```powershell
   git add .
   git commit -m "fix: make room_id OPTIONAL for /send-template"
   git push
   ```

2. **Deploy to Cloud Run**:
   ```powershell
   # Edit deploy-cloud-run.ps1 dulu (set PROJECT_ID)
   .\deploy-cloud-run.ps1
   ```

3. **Test**:
   ```powershell
   # Edit test-cloud-run.ps1 dulu (set CLOUD_RUN_URL)
   .\test-cloud-run.ps1
   ```

---

## Cloud Run Configuration Checklist ✅

- [ ] Code pushed to GitHub
- [ ] Docker image built with latest code
- [ ] Image pushed to Container Registry
- [ ] Cloud Run deployed with new image
- [ ] Environment variables set correctly
- [ ] Memory/CPU sufficient (recommended: 2Gi RAM, 2 CPU)
- [ ] Timeout set correctly (recommended: 300s)
- [ ] Database connection works
- [ ] WhatsApp API credentials valid

---

## Useful Commands:

```powershell
# Deploy
.\deploy-cloud-run.ps1

# Check logs
.\check-logs.ps1

# Test endpoint
.\test-cloud-run.ps1

# Update env vars only (no redeploy)
gcloud run services update boztell-backend `
  --region asia-southeast2 `
  --set-env-vars "NEW_VAR=value"

# Rollback to previous version
gcloud run services update-traffic boztell-backend `
  --to-revisions PREVIOUS_REVISION=100 `
  --region asia-southeast2

# List all revisions
gcloud run revisions list --service boztell-backend --region asia-southeast2
```

---

## Quick Fix Flowchart:

```
Works in Postman? 
  ├─ YES ──> Code is correct
  │          └─> Check if deployed to Cloud Run
  │              ├─ NO ──> Run: .\deploy-cloud-run.ps1
  │              └─ YES ──> Check environment variables
  │
  └─ NO ──> Fix code first, then deploy
```

---

## Need More Help?

1. Check full error logs:
   ```powershell
   gcloud logging read "resource.type=cloud_run_revision" --limit 100
   ```

2. Check Cloud Run Console:
   https://console.cloud.google.com/run

3. Test locally first:
   ```powershell
   npm run dev
   # Test on http://localhost:8080
   ```
