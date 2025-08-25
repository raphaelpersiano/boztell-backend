# 📮 Postman API Testing Documentation (FINAL CORRECTED)

Dokumentasi lengkap untuk testing Boztell WhatsApp Backend API menggunakan Postman.

## 🚨 IMPORTANT FIXES APPLIED - ALL ENDPOINTS CORRECTED

### ✅ ENDPOINT CORRECTIONS:

**WEBHOOK (Benar):**
- ✅ `/webhook/whatsapp` (tanpa `/api` prefix)

**MEDIA (Salah di Postman - Diperbaiki):**
- ✅ `/media/upload` (bukan `/api/media/upload`)
- ✅ `/media/list` (bukan `/api/media/list`)
- ✅ `/media/dates` (bukan `/api/media/dates`) 
- ✅ `/media/stats` (bukan `/api/media/stats`)
- ✅ `/media/:fileId` (info file)
- ✅ `/media/:fileId/refresh-url` (refresh URL)
- ✅ `/media/whatsapp-upload` (upload ke WhatsApp saja)

**API INFO & HEALTH (Benar):**
- ✅ `/health` (health check)
- ✅ `/api` (API info)

**TESTING ENDPOINTS (TIDAK ADA DI CODEBASE!):**
- ❌ `/api/test/firebase` - **TIDAK ADA**
- ❌ `/api/test/database` - **TIDAK ADA**  
- ❌ `/api/system/status` - **TIDAK ADA**

### ✅ WhatsApp Setup Info:
- **Business Number**: +15551466180 (Phone Number ID: 688261591046101)
- **Test Number**: 6287879565390 (hanya nomor ini yang authorized untuk testing)
- **Business Account ID**: 2569770200040122
- **Webhook Verify Token**: skor123

## 🚀 Quick Start

### 1. Import Collection & Environment

1. **Import Collection (BUTUH PERBAIKAN LAGI!):**
   - Buka Postman
   - Klik **Import**
   - ⚠️ **NEED NEW COLLECTION** - yang sekarang masih ada endpoint salah!

2. **Import Environment:**
   - Klik **Import** lagi  
   - Pilih file: `postman/Boztell-Production.postman_environment.json`

3. **Pilih Environment:**
   - Di kanan atas, pilih "Boztell Production" environment

### 2. Environment Variables (Sudah Dikonfigurasi)

Variables sudah di-set dengan nilai yang benar:

```
baseUrl = https://boztell-backend-38724074881.asia-southeast2.run.app
webhookVerifyToken = skor123
testPhoneNumber = 6287879565390  (authorized number)
businessPhoneId = 688261591046101  (+15551466180)
businessDisplayNumber = +15551466180
whatsappBusinessAccountId = 2569770200040122
testDate = 2025-08-25
```

## 📋 API Testing Flow (FINAL CORRECTED)

### 🏠 1. Health Check
Mulai dengan testing dasar:

```
✅ GET /health - Cek server status
✅ GET /api - Info API dan endpoints
```

### 📞 2. WhatsApp Webhook Testing (BENAR)

#### A. Webhook Verification
```
✅ GET /webhook/whatsapp?hub.mode=subscribe&hub.challenge=test&hub.verify_token=skor123
```

#### B. Message Testing
Test berbagai tipe pesan dengan nomor authorized:

```
✅ POST /webhook/whatsapp - Text Message (dari 6287879565390)
✅ POST /webhook/whatsapp - Image Message (dari 6287879565390)
✅ POST /webhook/whatsapp - Voice Message (dari 6287879565390)
✅ POST /webhook/whatsapp - Status Update
```

### 📁 3. Media Management (CORRECTED - TANPA /api PREFIX!)

#### A. Upload Media
```
✅ POST /media/upload
   - Form-data dengan file dan room_id=6287879565390
   - File akan tersimpan di: media/6287879565390/2025-08-25/
```

#### B. List & Download Media
```
✅ GET /media/list?phone=6287879565390&date=2025-08-25
✅ GET /media/dates?phone=6287879565390
✅ GET /media/stats?phone=6287879565390
✅ GET /media/:fileId - Get media file info
✅ POST /media/:fileId/refresh-url - Refresh expired URLs
✅ POST /media/whatsapp-upload - Upload directly to WhatsApp
```

### 🛠️ 4. API Info & Health (HANYA INI YANG ADA!)
```
✅ GET /health - Service health check
✅ GET /api - API information dan feature list
❌ TIDAK ADA endpoint /api/test/* atau /api/system/* di codebase!
```

**💡 Catatan Penting:**
- `entry.id` = WhatsApp Business Account ID (2569770200040122)
- `metadata.phone_number_id` = Phone Number ID (688261591046101)  
- `messages.from` = Customer phone (6287879565390) - hanya nomor ini yang authorized

## 🎯 Room Concept Testing (Updated)

Backend menggunakan konsep **1 room = 1 phone number** dengan nomor authorized:

### Contoh Testing Flow:

1. **Simulate incoming message** dari customer authorized `6287879565390`:
   ```json
   POST /webhook/whatsapp
   {
     "object": "whatsapp_business_account",
     "entry": [{
       "id": "2569770200040122",
       "changes": [{
         "value": {
           "metadata": {
             "phone_number_id": "688261591046101",
             "display_phone_number": "+15551466180"
           },
           "messages": [{
             "from": "6287879565390",
             "text": {"body": "Hello!"}
           }]
         }
       }]
     }]
   }
   ```

2. **Upload media** untuk customer yang sama:
   ```
   POST /media/upload
   Form data:
   - file: [pilih file]
   - room_id: 6287879565390
   ```

3. **List media** customer tersebut:
   ```
   GET /media/list?phone=6287879565390&date=2025-08-25
   ```

## 🗂️ Folder Structure di GCS (Updated)

File media akan tersimpan dengan struktur menggunakan nomor authorized:
```
media/
├── 6287879565390/          # Authorized customer phone number
│   ├── 2025-08-25/        # Date
│   │   ├── 1724572800000_image.jpg
│   │   └── 1724573900000_voice.ogg
│   └── 2025-08-26/
│       └── 1724659200000_document.pdf
```

## 🔒 Authentication & Security

- **Webhook Verification**: Token "skor123" (sudah di-set di environment)
- **Authorized Number**: Hanya 6287879565390 yang bisa kirim pesan untuk testing
- **Business Number**: +15551466180 (ID: 688261591046101)
- **File Upload**: Max 100MB, supported types: image, video, audio, document

## 🚨 Common Issues & Solutions (Updated)

### 1. Webhook URL Salah
```
❌ Error: /api/webhook/whatsapp not found
✅ Solution: Gunakan /webhook/whatsapp (tanpa /api prefix)
```

### 2. Media URL Salah  
```
❌ Error: /api/media/* endpoints not found
✅ Solution: Gunakan /media/* (tanpa /api prefix)
```

### 3. Testing Endpoints Tidak Ada
```
❌ Error: /api/test/firebase not found
❌ Error: /api/test/database not found  
❌ Error: /api/system/status not found
✅ Solution: Endpoints ini TIDAK ADA di codebase! Hapus dari testing.
```

### 4. Unauthorized Number
```
❌ Error: Message dari nomor tidak authorized
✅ Solution: Gunakan nomor 6287879565390 untuk testing
```

### 5. Wrong Entry ID
```
❌ Error: Gunakan Phone Number ID di entry.id
✅ Solution: Gunakan WhatsApp Business Account ID (2569770200040122) di entry.id
```

## 📊 Expected Response Examples (Updated)

### Successful Message Webhook:
```json
{
  "success": true,
  "processed": 1,
  "room_id": "6287879565390",
  "message_id": "wamid.test_text_123"
}
```

### Media Upload Success:
```json
{
  "success": true,
  "file": {
    "id": "uuid-here",
    "originalName": "photo.jpg",
    "size": 1234567,
    "url": "https://storage.googleapis.com/...",
    "gcsFilename": "media/6287879565390/2025-08-25/1724572800000_photo.jpg"
  }
}
```

### Storage Stats:
```json
{
  "phoneNumber": "6287879565390",
  "totalFiles": 5,
  "totalSize": 12345678,
  "totalSizeHuman": "11.8 MB",
  "mediaTypes": {
    "image": 3,
    "audio": 1,
    "video": 1
  }
}
```

## 🎉 Testing Checklist (Final Corrected)

- [ ] Health check passed (/health)
- [ ] API info working (/api)
- [ ] Webhook verification working (/webhook/whatsapp - GET)
- [ ] Can receive text messages (dari 6287879565390)
- [ ] Can receive media messages (dari 6287879565390)  
- [ ] Media upload working (/media/upload - room_id = 6287879565390)
- [ ] Media list working (/media/list)
- [ ] Media dates working (/media/dates)
- [ ] Media stats working (/media/stats)
- [ ] Room concept working (6287879565390 = room ID)

## 🚀 Quick Test Commands

Jalankan ini untuk test cepat di browser/curl:

```bash
# 1. Health check
curl https://boztell-backend-38724074881.asia-southeast2.run.app/health

# 2. API info  
curl https://boztell-backend-38724074881.asia-southeast2.run.app/api

# 3. Webhook verification
curl "https://boztell-backend-38724074881.asia-southeast2.run.app/webhook/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=skor123"

# 4. Media endpoints (require POST with proper data)
# curl https://boztell-backend-38724074881.asia-southeast2.run.app/media/list?phone=6287879565390&date=2025-08-25
```

## 🔧 NEXT STEPS YANG DIPERLUKAN:

1. **Buat Postman Collection Baru** dengan endpoint yang benar:
   - Hapus semua `/api/test/*` dan `/api/system/*` endpoints
   - Fix semua `/api/media/*` menjadi `/media/*`
   - Pastikan `/webhook/whatsapp` sudah benar

2. **Update Test Scripts** di Postman untuk mencegah testing endpoint yang tidak ada

3. **Fokus Testing** pada endpoint yang benar-benar ada di codebase

Happy testing! 🚀

---

**SUMMARY: Prefix `/api` HANYA digunakan untuk endpoint `/api` (info endpoint). Semua endpoint lain (`/webhook/*`, `/media/*`, `/devices/*`) TIDAK menggunakan prefix `/api`!**
