# 🎯 MEDIA TESTING GUIDE - Boztell WhatsApp Backend

## 📋 Media Endpoints Overview

### 1. 📤 Upload and Send Media File (One-Step)
**Endpoint:** `POST /messages/send-media-file`
**Purpose:** Upload file dan langsung kirim ke customer dalam satu request

**How to test:**
1. Open Postman → "Upload and Send Media File"
2. Body tab → form-data
3. Add fields:
   - `media` (File): Select image/document file
   - `to` (Text): Phone number (e.g., 6281234567890)
   - `caption` (Text, optional): Description text
4. Send → File uploaded to WhatsApp + sent to customer

---

### 2. 📁 Upload Media (Get ID)
**Endpoint:** `POST /messages/upload-media`
**Purpose:** Upload file ke WhatsApp, dapat media ID untuk reuse

**How to test:**
1. Open Postman → "Upload Media (Get ID)"
2. Body tab → form-data
3. Add field:
   - `media` (File): Select any file
4. Send → Get WhatsApp media ID

**Response example:**
```json
{
  "success": true,
  "media_id": "abc123xyz789",
  "message": "Media uploaded successfully"
}
```

---

### 3. 🚀 Send Media by ID/URL
**Endpoint:** `POST /messages/send-media`
**Purpose:** Send media menggunakan media ID atau URL

**Test with media ID:**
```json
{
  "to": "6281234567890",
  "type": "image",
  "media": {
    "id": "abc123xyz789"
  },
  "caption": "Photo description"
}
```

**Test with media URL:**
```json
{
  "to": "6281234567890", 
  "type": "image",
  "media": {
    "link": "https://example.com/image.jpg"
  },
  "caption": "Photo from URL"
}
```

---

## 📁 Supported File Types

### 🖼️ Images (max 5MB)
- JPG, JPEG, PNG, WebP

### 📄 Documents (max 100MB)  
- PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT

### 🎵 Audio (max 16MB)
- AAC, M4A, AMR, MP3, OGG OPUS

### 🎥 Video (max 16MB)
- MP4, 3GPP

---

## 🧪 Testing Flow

### Step 1: Test Upload Only
1. Use "Upload Media (Get ID)" endpoint
2. Upload sample file
3. Save media_id from response

### Step 2: Test Send by ID
1. Use "Send Media" endpoint  
2. Send JSON with media.id
3. Check WhatsApp app on test number

### Step 3: Test Upload+Send
1. Use "Upload and Send Media File" endpoint
2. Upload file + add phone number
3. File should appear in WhatsApp immediately

---

## 🔧 Environment Variables

Make sure these are set in Postman:
- `baseUrl`: https://boztell-backend-38724074881.asia-southeast2.run.app  
- `testPhoneNumber`: Your authorized test number (e.g., 6281234567890)
- `accessToken`: Your WhatsApp Business access token
- `webhookVerifyToken`: Your webhook verify token

---

## 🐛 Common Issues & Solutions

### ❌ "Media upload failed"
- Check file size limits
- Verify file type is supported
- Ensure access token is valid

### ❌ "Phone number not authorized"  
- Use only authorized test numbers in WhatsApp Business account
- Format: country code + number (no + sign)

### ❌ "Media not found"
- Media IDs expire after 30 days
- Re-upload file to get new ID

---

## 💡 Pro Tips

1. **Test Order:** Upload → Send by ID → Upload+Send
2. **File Types:** Start with small PNG images for testing
3. **Captions:** Always test with and without captions
4. **Reuse:** Media IDs can be reused for 30 days
5. **URLs:** External URLs must be publicly accessible

Ready untuk testing! 🚀
