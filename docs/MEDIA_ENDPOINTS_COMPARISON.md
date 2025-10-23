# Media Endpoints Comparison

## Overview: 3 Cara Kirim Media

Ada **3 endpoint berbeda** untuk kirim media ke WhatsApp, masing-masing punya use case yang berbeda:

| Endpoint | Upload to Supabase Storage | Upload to WhatsApp | Send to WhatsApp | Save to DB | Socket.IO | Use Case |
|----------|----------------------------|-------------------|------------------|------------|-----------|----------|
| `/send-media` | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Media sudah ada (by ID or URL) |
| `/send-media-file` | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Upload & kirim (tidak perlu storage) |
| `/send-media-combined` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Full flow (dengan backup Supabase) |

---

## 1. POST `/messages/send-media`

### Purpose
Kirim media yang **SUDAH ada** di WhatsApp (punya media ID) atau di URL publik.

### When to Use
- ✅ Media sudah pernah di-upload ke WhatsApp sebelumnya (punya `media_id`)
- ✅ Media sudah ada di URL publik yang accessible
- ✅ Tidak perlu backup media ke Supabase Storage
- ✅ Untuk resend media yang sama ke customer berbeda (efisien)

### Request
```json
{
  "to": "6287879565390",
  "mediaType": "image",
  "mediaId": "12345678", // WhatsApp media ID (OR)
  "mediaUrl": "https://example.com/image.jpg", // Public URL (OR)
  "caption": "Optional caption",
  "filename": "photo.jpg",
  "user_id": "agent-uuid"
}
```

### Flow
```
1. Check mediaId OR mediaUrl provided
2. Send to WhatsApp using sendMediaMessage() or sendMediaByUrl()
3. Get wa_message_id from response
4. Save to database (with mediaId/mediaUrl but NO gcs_filename/gcs_url)
5. Emit Socket.IO event
6. Return response
```

### Database Record
```json
{
  "content_type": "media",
  "media_type": "image",
  "media_id": "12345678",
  "gcs_filename": null,
  "gcs_url": "https://example.com/image.jpg", // OR null if using mediaId
  "file_size": null,
  "mime_type": null
}
```

**Note:** Field `gcs_url` dan `gcs_filename` sebenarnya merujuk ke **Supabase Storage**, bukan Google Cloud Storage. Nama kolom ini legacy dari awal development.

### Pros & Cons
✅ **Fastest** - tidak ada upload overhead  
✅ **Efficient** - reuse media yang sudah ada  
✅ **Simple** - langsung kirim  
❌ **No backup** - media tidak disimpan ke Supabase Storage  
❌ **No metadata** - file size, mime type tidak tercatat  

---

## 2. POST `/messages/send-media-file`

### Purpose
Upload file dari local device → WhatsApp, kirim ke customer, **tanpa backup ke Supabase Storage**.

### When to Use
- ✅ Agent upload media baru dari device
- ✅ Tidak perlu backup permanen ke Supabase Storage
- ✅ Cukup simpan di WhatsApp saja (WhatsApp menyimpan media untuk beberapa waktu)
- ✅ Hemat storage cost (tidak double upload)

### Request (multipart/form-data)
```
POST /messages/send-media-file
Content-Type: multipart/form-data

Fields:
- media: [file binary]
- to: "6287879565390"
- caption: "Optional caption"
- user_id: "agent-uuid"
```

### Flow
```
1. Receive file upload (buffer in memory)
2. Detect media type from MIME type
3. Upload to WhatsApp using uploadMediaToWhatsApp() → get media_id
4. Send to WhatsApp using sendMediaMessage() with media_id
5. Get wa_message_id from response
6. Save to database (with media_id but NO gcs_filename/gcs_url)
7. Emit Socket.IO event
8. If document + caption → send separate text message
9. Return response
```

### Database Record
```json
{
  "content_type": "media",
  "media_type": "image",
  "media_id": "whatsapp-media-id",
  "gcs_filename": null,
  "gcs_url": null,
  "file_size": 245678, // from buffer.length
  "mime_type": "image/jpeg",
  "original_filename": "photo.jpg"
}
```

### Pros & Cons
✅ **Simple upload** - langsung dari device ke WhatsApp  
✅ **No storage cost** - tidak pakai Supabase Storage  
✅ **Has metadata** - file size, mime type, filename tercatat  
❌ **No permanent backup** - media cuma ada di WhatsApp  
❌ **WhatsApp retention** - WhatsApp bisa hapus media setelah beberapa waktu  

---

## 3. POST `/messages/send-media-combined`

### Purpose
**FULL FLOW** - Upload file → Backup ke Supabase Storage → Upload ke WhatsApp → Kirim ke customer.

### When to Use
- ✅ **RECOMMENDED for production** - media disimpan permanen
- ✅ Need permanent backup of all media
- ✅ Compliance/audit requirements (harus simpan media selamanya)
- ✅ WhatsApp media bisa expire, tapi punya backup di Supabase Storage
- ✅ Bisa serve media dari Supabase Storage jika WhatsApp media sudah expire

### Request (multipart/form-data)
```
POST /messages/send-media-combined
Content-Type: multipart/form-data

Fields:
- media: [file binary]
- to: "6287879565390"
- caption: "Optional caption"
- user_id: "agent-uuid"
```

### Flow
```
1. Receive file upload (buffer in memory)
2. Upload to Supabase Storage using uploadBuffer()
   → Organized: whatsapp-media/{phone}/{YYYY-MM-DD}/{timestamp}_{filename}
   → Get public URL from Supabase Storage
3. Upload to WhatsApp using uploadMediaToWhatsApp() → get media_id
4. Send to WhatsApp using sendMediaMessage() with media_id
5. Get wa_message_id from response
6. Save to database (with BOTH media_id AND gcs_filename/gcs_url)
7. Emit Socket.IO event
8. If document + caption → send separate text message
9. Return response
```

**Note:** Database columns `gcs_filename` dan `gcs_url` adalah legacy naming - sebenarnya menyimpan path dan URL dari **Supabase Storage**, bukan Google Cloud Storage.

### Database Record
```json
{
  "content_type": "media",
  "media_type": "image",
  "media_id": "whatsapp-media-id",
  "gcs_filename": "whatsapp-media/6287879565390/2025-10-23/1698012345_photo.jpg",
  "gcs_url": "https://[supabase-project].supabase.co/storage/v1/object/public/...",
  "file_size": 245678,
  "mime_type": "image/jpeg",
  "original_filename": "photo.jpg"
}
```

### Pros & Cons
✅ **Permanent backup** - media tersimpan selamanya di Supabase Storage  
✅ **Dual source** - bisa ambil dari WhatsApp ATAU Supabase Storage  
✅ **Compliance ready** - untuk audit/legal requirements  
✅ **Organized storage** - struktur folder by phone/date  
✅ **Full metadata** - semua info lengkap  
❌ **Slower** - double upload (Supabase Storage + WhatsApp)  
❌ **Storage cost** - pakai Supabase Storage (free tier 1GB)  
❌ **More complex** - ada 2 upload steps  

---

## Decision Matrix

### Scenario 1: Agent kirim foto produk ke customer
**Recommendation:** `/send-media-combined`
- Foto perlu disimpan untuk record
- Bisa dipakai lagi nanti (katalog)
- Compliance requirement
- Media tersimpan permanen di Supabase Storage

### Scenario 2: Agent resend foto yang sama ke 100 customers
**Recommendation:** `/send-media` (setelah upload pertama kali)
```javascript
// First customer - use combined
POST /send-media-combined → get media_id: "ABC123"

// Next 99 customers - reuse media_id
POST /send-media
{
  "to": "customer2",
  "mediaType": "image",
  "mediaId": "ABC123" // Reuse!
}
```

### Scenario 3: Agent kirim screenshot temporary untuk troubleshooting
**Recommendation:** `/send-media-file`
- Tidak perlu backup permanen di Supabase Storage
- Just for one-time use
- Hemat storage quota

### Scenario 4: Media sudah ada di CDN/URL publik
**Recommendation:** `/send-media`
```javascript
{
  "to": "customer",
  "mediaType": "image",
  "mediaUrl": "https://cdn.company.com/promo.jpg"
}
```

---

## Voice Note Support

**WhatsApp sends voice notes as:**
- `type: "audio"`
- `mime_type: "audio/ogg; codecs=opus"`
- Field `ptt: true` (push-to-talk)

**All 3 endpoints support voice notes:**
- Detect as `mediaType: "audio"`
- No special handling needed
- Frontend should check `mime_type` or `metadata.ptt` to show voice note UI

**To differentiate:**
```javascript
// In webhook handler - could add this
if (message.audio?.mime_type === 'audio/ogg; codecs=opus') {
  metadata.is_voice_note = true;
}

// Or check ptt field
if (message.audio?.ptt === true) {
  metadata.is_voice_note = true;
}
```

---

## Storage Organization (Supabase Storage)

### `/send-media-combined` creates structure:
```
whatsapp-media/
  ├── 6287879565390/           ← Phone number
  │   ├── 2025-10-23/          ← Date
  │   │   ├── 1698012345_photo.jpg
  │   │   ├── 1698012678_document.pdf
  │   │   └── 1698013000_video.mp4
  │   └── 2025-10-24/
  │       └── ...
  └── 6281234567890/
      └── ...
```

### Benefits:
- ✅ Easy to find media by phone/date
- ✅ Easy to cleanup old media
- ✅ Easy to export media for specific customer
- ✅ Organized for compliance/audit
- ✅ Integrated with Supabase (same platform as database)
- ✅ Free tier: 1GB storage included

---

## Migration Strategy

### Current State Analysis
- Customer messages from webhook → use `handleIncomingMedia()` → **ALWAYS save to Supabase Storage**
- Agent messages from API → **3 different endpoints** with different behaviors

### Recommendation
1. **For webhook (incoming)**: Keep using Supabase Storage (already implemented)
2. **For API (outgoing)**:
   - Use `/send-media-combined` as **default/recommended**
   - Keep `/send-media` for **optimization** (reuse media)
   - Keep `/send-media-file` for **lightweight** use case

---

## Summary Table

| Feature | send-media | send-media-file | send-media-combined |
|---------|------------|-----------------|---------------------|
| File Upload | ❌ No | ✅ Yes | ✅ Yes |
| Upload to WhatsApp | ❌ (uses existing) | ✅ Yes | ✅ Yes |
| Upload to Supabase Storage | ❌ No | ❌ No | ✅ Yes |
| Send to Customer | ✅ Yes | ✅ Yes | ✅ Yes |
| Save to Database | ✅ Yes | ✅ Yes | ✅ Yes |
| Socket.IO Emit | ✅ Yes | ✅ Yes | ✅ Yes |
| Has `media_id` | ✅ Yes (input) | ✅ Yes (from upload) | ✅ Yes (from upload) |
| Has `gcs_url` | ⚠️ Optional (if mediaUrl) | ❌ No | ✅ Yes |
| File Metadata | ❌ Limited | ✅ Yes | ✅ Yes |
| Permanent Backup | ❌ No | ❌ No | ✅ Yes |
| Speed | ⚡ Fastest | 🚀 Fast | 🐢 Slower (2 uploads) |
| Storage Cost | 💰 Free | 💰 Free | 💰 Low (Supabase free tier 1GB) |
| Use Case | Resend existing | One-time send | Production (with backup) |

---

## API Response Comparison

### `/send-media`
```json
{
  "success": true,
  "message_id": "uuid",
  "whatsapp_message_id": "wamid.xxx",
  "mediaId": "12345678",
  "mediaUrl": null
}
```

### `/send-media-file`
```json
{
  "success": true,
  "message_id": "uuid",
  "whatsapp_media_id": "12345678",
  "whatsapp_message_id": "wamid.xxx",
  "filename": "photo.jpg",
  "size": 245678
}
```

### `/send-media-combined`
```json
{
  "success": true,
  "message_id": "uuid",
  "whatsapp_media_id": "12345678",
  "whatsapp_message_id": "wamid.xxx",
  "storage_url": "https://[project].supabase.co/storage/v1/object/public/...",
  "storage_filename": "whatsapp-media/6287879565390/2025-10-23/1698012345_photo.jpg",
  "filename": "photo.jpg",
  "size": 245678
}
```

---

## Recommendation: Default Endpoint

**Use `/send-media-combined` as the default** for these reasons:

1. ✅ **Data retention** - Media tersimpan permanen
2. ✅ **Compliance** - Memenuhi audit requirement
3. ✅ **Fallback** - Jika WhatsApp media expire, masih ada di Supabase Storage
4. ✅ **Analytics** - Bisa analyze media usage by customer/date
5. ✅ **Backup** - Disaster recovery ready
6. ✅ **Integrated** - Same platform as database (Supabase)

**Cost is minimal** compared to benefits:
- Supabase Storage Free Tier: 1GB included
- Beyond free tier: ~$0.021/GB/month
- Average image: 500KB
- Storage for 2,000 images = 1GB = FREE
- 10,000 images = 5GB = ~$0.08/month

**For optimization**, use `/send-media` to reuse media across customers.

---

## Technical Notes

### Legacy Column Names
Database columns `gcs_filename` dan `gcs_url` adalah **legacy naming** dari awal development. Sebenarnya menyimpan:
- **`gcs_filename`**: Path di Supabase Storage (e.g., `whatsapp-media/6287879565390/2025-10-23/1698012345_photo.jpg`)
- **`gcs_url`**: Public URL dari Supabase Storage (e.g., `https://[project].supabase.co/storage/v1/object/public/...`)

**NOT Google Cloud Storage!** Semua storage menggunakan **Supabase Storage**.

### Storage Service
File `src/services/storageService.js` menyediakan:
- `uploadBuffer()` - Upload buffer ke Supabase Storage
- `uploadStream()` - Upload stream ke Supabase Storage
- `generateSignedUrl()` - Generate signed URL untuk private files

Imported di `messages.js` dengan alias:
```javascript
import { uploadBuffer as uploadToGCS } from '../services/storageService.js';
```

**Note:** Alias `uploadToGCS` adalah misleading - sebenarnya upload ke Supabase Storage!
