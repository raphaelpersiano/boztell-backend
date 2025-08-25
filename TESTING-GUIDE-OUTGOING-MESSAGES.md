# Testing Guide - Outgoing Messages API

## Quick Start Testing

### 🚀 TESTING WORKFLOW LENGKAP

Ikuti langkah-langkah ini untuk menguji semua fitur outgoing messages:

#### Prerequisites
1. Server running di `http://localhost:8080`
2. WhatsApp Business API sudah dikonfigurasi
3. Nomor test sudah terdaftar: `15559876543`
4. Import Postman collection: `Boztell-WhatsApp-Backend-COMPLETE.postman_collection.json`

---

## 1. TESTING LOCATION MESSAGES

### Test Case 1: Send Location dengan Nama dan Alamat
```bash
POST /messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "type": "location",
  "location": {
    "latitude": -6.2088,
    "longitude": 106.8456,
    "name": "Monas Jakarta",
    "address": "Jl. Silang Monas, Gambir, Jakarta Pusat"
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message_id": "wamid.xxx",
  "wa_message_id": "wamid.xxx"
}
```

**Verification:**
- ✅ Pesan location muncul di WhatsApp customer
- ✅ Koordinat bisa dibuka di Google Maps
- ✅ Nama dan alamat tampil dengan benar

### Test Case 2: Send Location tanpa Nama/Alamat
```bash
POST /messages/send
Content-Type: application/json

{
  "to": "15559876543", 
  "type": "location",
  "location": {
    "latitude": -6.1951,
    "longitude": 106.8231
  }
}
```

**Verification:**
- ✅ Location pin muncul tanpa nama/alamat
- ✅ Koordinat tetap akurat

---

## 2. TESTING REPLY MESSAGES

### Step 1: Kirim Pesan Initial
```bash
POST /messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "text": "Pesan ini akan di-reply. Simpan wa_message_id!",
  "type": "text"
}
```

**IMPORTANT:** Copy `wa_message_id` dari response!

### Step 2: Kirim Reply
```bash
POST /messages/send  
Content-Type: application/json

{
  "to": "15559876543",
  "text": "Ini adalah reply ke pesan sebelumnya",
  "type": "text",
  "context": {
    "message_id": "PASTE_WA_MESSAGE_ID_DARI_STEP_1"
  }
}
```

**Verification:**
- ✅ Reply message muncul dengan quote/reference ke pesan original
- ✅ Thread/conversation terbentuk dengan benar
- ✅ Context message terlihat di WhatsApp

---

## 3. TESTING REACTION MESSAGES

### Step 1: Kirim Pesan untuk di-React
```bash
POST /messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "text": "Pesan ini akan diberi reaction 👍",
  "type": "text"
}
```

**IMPORTANT:** Copy `wa_message_id` dari response!

### Step 2: Kirim Reaction
```bash
POST /messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "PASTE_WA_MESSAGE_ID_DARI_STEP_1",
    "emoji": "👍"
  }
}
```

**Verification:**
- ✅ Emoji reaction muncul di pesan target
- ✅ Reaction counter bertambah
- ✅ Notification reaction sampai ke customer

### Test Multiple Reactions
```bash
# Heart reaction
{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "SAME_MESSAGE_ID",
    "emoji": "❤️"
  }
}

# Laughing reaction  
{
  "to": "15559876543",
  "type": "reaction", 
  "reaction": {
    "message_id": "SAME_MESSAGE_ID",
    "emoji": "😂"
  }
}

# Remove reaction
{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "SAME_MESSAGE_ID", 
    "emoji": ""
  }
}
```

---

## 4. COMPLETE TESTING WORKFLOW

Gunakan section "8. Complete Testing Workflow" di Postman collection:

### Step 1: Send Initial Message
- ✅ Kirim pesan pertama
- ✅ Copy `wa_message_id` dari response
- ✅ Update Postman variables:
  - `repliedWaMessageId` = wa_message_id dari step 1
  - `reactionTargetWaMessageId` = wa_message_id dari step 1

### Step 2: Send Reply
- ✅ Reply otomatis menggunakan variable
- ✅ Verify reply thread terbentuk

### Step 3: Send Reaction
- ✅ Reaction otomatis menggunakan variable
- ✅ Verify emoji muncul di pesan target

### Step 4: Send Location
- ✅ Location sebagai penutup testing
- ✅ Verify semua fitur working

---

## 5. ERROR TESTING

### Test Invalid Message ID untuk Reply
```bash
POST /messages/send
{
  "to": "15559876543",
  "text": "Reply with invalid ID",
  "type": "text", 
  "context": {
    "message_id": "invalid_message_id"
  }
}
```

**Expected:** Error response dari WhatsApp API

### Test Invalid Coordinates untuk Location
```bash
POST /messages/send
{
  "to": "15559876543",
  "type": "location",
  "location": {
    "latitude": 999,
    "longitude": 999
  }
}
```

**Expected:** Error karena koordinat invalid

### Test Unsupported Emoji untuk Reaction
```bash
POST /messages/send
{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "valid_message_id",
    "emoji": "🔥💯✨"
  }
}
```

**Expected:** Mungkin error atau hanya emoji pertama yang diterima

---

## 6. POSTMAN COLLECTION TESTING

### Import Collection
1. Import file: `Boztell-WhatsApp-Backend-COMPLETE.postman_collection.json`
2. Set environment variables:
   ```
   baseUrl: http://localhost:8080
   testPhoneNumber: 15559876543
   ```

### Update Variables untuk Reply/Reaction Testing
1. Jalankan "Send Custom Text Message"
2. Copy `wa_message_id` dari response
3. Update variables:
   - Right-click collection → Edit
   - Go to Variables tab
   - Update `repliedWaMessageId` dan `reactionTargetWaMessageId`
   - Save

### Run Testing Sequence
1. **Section 3:** Test basic text messages
2. **Section 4:** Test location messages
3. **Section 8:** Run complete workflow
4. **Section 5 & 6:** Test reply dan reaction

---

## 7. VERIFICATION CHECKLIST

### ✅ Location Messages
- [ ] Location pin muncul di WhatsApp
- [ ] Koordinat akurat (bisa dibuka di maps)
- [ ] Nama lokasi tampil (jika ada)
- [ ] Alamat tampil (jika ada)

### ✅ Reply Messages  
- [ ] Reply muncul dengan quote original message
- [ ] Thread conversation terbentuk
- [ ] Context message terlihat jelas
- [ ] Reply notification sampai ke customer

### ✅ Reaction Messages
- [ ] Emoji reaction muncul di message target
- [ ] Reaction counter bertambah
- [ ] Multiple reactions bisa dikirim
- [ ] Remove reaction working
- [ ] Reaction notification sampai ke customer

### ✅ Error Handling
- [ ] Invalid message ID di-handle dengan proper error
- [ ] Invalid coordinates di-handle dengan proper error
- [ ] Missing required fields di-handle dengan proper error

---

## 8. TROUBLESHOOTING

### Problem: Reply tidak muncul dengan quote
**Solution:**
- Pastikan `wa_message_id` benar dan valid
- Pastikan message yang di-reply masih dalam conversation window (< 24 jam)
- Check console logs untuk error WhatsApp API

### Problem: Reaction tidak muncul
**Solution:**  
- Pastikan emoji didukung WhatsApp (gunakan emoji basic: 👍❤️😂😮😢😡🙏)
- Pastikan message target masih ada
- Check apakah multiple reactions allowed

### Problem: Location tidak akurat
**Solution:**
- Gunakan decimal degrees format
- Pastikan latitude: -90 to 90, longitude: -180 to 180
- Test dengan koordinat yang valid dulu

### Problem: Server Error 500
**Solution:**
- Check server logs di terminal
- Pastikan WhatsApp Business API credentials benar
- Verify database connection
- Check network connectivity

---

## 9. ADVANCED TESTING

### Test dengan Media + Reply
```bash
POST /messages/send-media-file
Form Data:
- media: [SELECT FILE]
- to: 15559876543
- caption: "Media with reply context"
- context_message_id: "wa_message_id_from_previous"
```

### Test Performance
- Kirim 10 messages berturut-turut
- Monitor response time
- Check database untuk message storage
- Verify semua messages delivered

### Test Edge Cases
- Reply ke reply message (nested replies)
- Reaction ke media message
- Location dengan koordinat ekstrem (kutub/ekuator)
- Long text dalam location name/address

---

## 10. DOCUMENTATION LINKS

- **API Documentation:** `API-OUTGOING-MESSAGES.md`
- **Complete Postman Collection:** `Boztell-WhatsApp-Backend-COMPLETE.postman_collection.json`
- **Server Logs:** Check terminal output
- **WhatsApp Business API Docs:** https://developers.facebook.com/docs/whatsapp

**Happy Testing! 🚀**
