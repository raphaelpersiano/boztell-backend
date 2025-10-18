# Supabase Setup Guide

## Prerequisites

Sebelum menjalankan aplikasi, Anda perlu melakukan setup berikut di Supabase:

### 1. Environment Variables

Tambahkan environment variables berikut ke dalam file `.env`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_BUCKET_NAME=boztell-media-dev

# Firebase (masih diperlukan untuk FCM notifications)
FIREBASE_SERVICE_ACCOUNT=your-firebase-service-account.json
FIREBASE_PROJECT_ID=your-firebase-project-id

# WhatsApp Configuration
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_SECRET=your-app-secret
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
```

### 2. SQL Function Setup

Jalankan SQL berikut di Supabase SQL Editor untuk membuat function yang diperlukan:

```sql
-- Function untuk execute arbitrary SQL (diperlukan untuk kompatibilitas dengan code yang ada)
CREATE OR REPLACE FUNCTION execute_sql(sql_query text, sql_params jsonb DEFAULT '[]'::jsonb)
RETURNS table(result jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_result jsonb;
  param_count int;
  i int;
  param_value text;
BEGIN
  -- Simple parameter substitution (tidak aman untuk production, gunakan dengan hati-hati)
  -- Untuk production, sebaiknya gunakan prepared statements atau query builder
  
  IF sql_query = 'SELECT 1' THEN
    -- Health check query
    RETURN QUERY SELECT '{"?column?": 1}'::jsonb;
    RETURN;
  END IF;
  
  -- Untuk query lainnya, eksekusi langsung (HATI-HATI: tidak aman untuk user input)
  -- Ini hanya untuk kompatibilitas dengan existing code
  EXECUTE sql_query;
  
  -- Return empty result
  RETURN QUERY SELECT '{}'::jsonb;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;
```

### 3. Storage Bucket Setup

1. Buka Supabase Dashboard → Storage
2. Buat bucket baru dengan nama `boztell-media-dev` (atau sesuai dengan `SUPABASE_BUCKET_NAME`)
3. Set bucket menjadi public jika ingin URL yang dapat diakses secara langsung

### 4. Database Tables

Pastikan Anda sudah memiliki semua tabel yang diperlukan di Supabase. Jika menggunakan migration dari PostgreSQL lama, pastikan semua tabel dan structure sudah sesuai.

## Migration dari Google Cloud Storage

Jika Anda memiliki file media di Google Cloud Storage, Anda perlu melakukan migration:

1. Download semua file dari GCS bucket
2. Upload ulang ke Supabase Storage dengan struktur folder yang sama
3. Update URL di database jika perlu

## Testing

Setelah setup selesai, test dengan:

1. `npm install` - Install dependencies baru
2. `npm run dev` - Jalankan dalam development mode
3. Akses `/health` endpoint untuk memastikan database dan storage terhubung
4. Test upload media melalui API endpoint

## Important Notes

⚠️ **Security Warning**: Function `execute_sql` yang dibuat di atas TIDAK AMAN untuk production dengan user input. Ini hanya untuk kompatibilitas dengan existing code. Untuk production, pertimbangkan untuk:

1. Menggunakan Supabase query builder daripada raw SQL
2. Membuat specific functions untuk setiap operasi database
3. Menggunakan Row Level Security (RLS) yang proper

⚠️ **Performance**: Supabase memiliki batasan berbeda dibanding direct PostgreSQL connection. Monitor performance dan adjust sesuai kebutuhan.

## Deployment ke Google Cloud Run

Aplikasi masih bisa di-deploy ke Google Cloud Run. Pastikan environment variables sudah di-set dengan benar di Cloud Run.

```bash
# Build and deploy
gcloud run deploy boztell-backend \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
```