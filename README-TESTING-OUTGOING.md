# 📋 README - Testing Outgoing Messages

## 🚀 Quick Setup

### 1. Import ke Postman
- **Collection:** `postman/Boztell-WhatsApp-Backend-COMPLETE.postman_collection.json`
- **Environment:** `postman/Boztell-Complete-Testing.postman_environment.json`

### 2. Konfigurasi Environment
Buka Environment di Postman dan update variabel penting:

```
testPhoneNumber: 15559876543  → GANTI dengan nomor WhatsApp yang valid
baseUrl: http://localhost:8080  → Sesuaikan dengan server Anda
```

### 3. Start Server
```bash
cd c:\Project\boztell-backend
npm start
```

---

## 📱 Testing Locations

### Quick Test - Location Basic
```bash
POST http://localhost:8080/messages/send
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

### ✅ Hasil yang Diharapkan:
- Location pin muncul di WhatsApp customer
- Bisa dibuka di Google Maps
- Nama "Monas Jakarta" tampil
- Alamat lengkap tampil

---

## 💬 Testing Replies

### Step-by-Step Reply Testing

#### Step 1: Kirim Pesan Pertama
```bash
POST http://localhost:8080/messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "text": "Pesan ini akan di-reply. Simpan wa_message_id!",
  "type": "text"
}
```

#### Step 2: Copy wa_message_id
Dari response Step 1, copy nilai `wa_message_id`:
```json
{
  "success": true,
  "wa_message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA"
}
```

#### Step 3: Kirim Reply
```bash
POST http://localhost:8080/messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "text": "Ini adalah reply ke pesan sebelumnya",
  "type": "text",
  "context": {
    "message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA"
  }
}
```

### ✅ Hasil yang Diharapkan:
- Reply message muncul dengan quote original message
- Thread conversation terbentuk
- Customer bisa lihat context message

---

## 😀 Testing Reactions

### Step-by-Step Reaction Testing

#### Step 1: Kirim Pesan untuk di-React
```bash
POST http://localhost:8080/messages/send
Content-Type: application/json

{
  "to": "15559876543",
  "text": "Pesan ini akan diberi reaction 👍",
  "type": "text"
}
```

#### Step 2: Copy wa_message_id & Kirim Reaction
```bash
POST http://localhost:8080/messages/send
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

### ✅ Hasil yang Diharapkan:
- Emoji 👍 muncul di pesan target
- Reaction counter bertambah
- Customer menerima notification reaction

### Supported Emojis:
- 👍 👎 ❤️ 😂 😮 😢 😡 🙏

### Remove Reaction:
```bash
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

## 🔄 Complete Workflow Testing

Gunakan Postman Collection section **"8. Complete Testing Workflow"**:

### Workflow Steps:
1. **Step 1:** Send Initial Message → Copy `wa_message_id`
2. **Update Variables:** Set `repliedWaMessageId` & `reactionTargetWaMessageId`
3. **Step 2:** Send Reply (otomatis menggunakan variable)
4. **Step 3:** Send Reaction (otomatis menggunakan variable)  
5. **Step 4:** Send Location (penutup testing)

### Update Variables di Postman:
1. Right-click Collection → Edit
2. Go to Variables tab
3. Update values:
   ```
   repliedWaMessageId: wamid.xxx_dari_step_1
   reactionTargetWaMessageId: wamid.xxx_dari_step_1
   ```
4. Save

---

## 🛠 Troubleshooting

### Problem: Reply tidak muncul dengan quote
**Solusi:**
- Pastikan `wa_message_id` valid dan benar
- Message yang di-reply harus dalam 24 jam window
- Check server logs untuk error

### Problem: Reaction tidak muncul  
**Solusi:**
- Gunakan emoji yang didukung: 👍❤️😂😮😢😡🙏
- Pastikan message target masih ada
- Check WhatsApp API response di logs

### Problem: Location tidak akurat
**Solusi:**
- Format: decimal degrees (contoh: -6.2088, 106.8456)
- Range: latitude (-90 to 90), longitude (-180 to 180)
- Test dengan koordinat Jakarta/Monas dulu

### Problem: Server Error 500
**Solusi:**
- Check server running: `npm start`
- Check environment variables WhatsApp API
- Check database connection
- Check console logs untuk detail error

---

## 📚 File Documentation

| File | Purpose |
|------|---------|
| `API-OUTGOING-MESSAGES.md` | Complete API documentation |
| `TESTING-GUIDE-OUTGOING-MESSAGES.md` | Detailed testing procedures |
| `postman/Boztell-WhatsApp-Backend-COMPLETE.postman_collection.json` | Complete Postman collection |
| `postman/Boztell-Complete-Testing.postman_environment.json` | Postman environment variables |

---

## 🎯 Success Criteria

### ✅ Location Messages
- [ ] Location pin tampil di WhatsApp
- [ ] Koordinat akurat (bisa buka maps)
- [ ] Nama & alamat tampil (jika disediakan)

### ✅ Reply Messages
- [ ] Reply dengan quote/reference original message
- [ ] Thread conversation terbentuk
- [ ] Context message terlihat jelas

### ✅ Reaction Messages  
- [ ] Emoji reaction muncul di message target
- [ ] Multiple reactions bisa dikirim
- [ ] Remove reaction working
- [ ] Notification sampai ke customer

---

## 🚀 Pro Tips

1. **Testing Sequence:** Selalu test text message dulu sebelum reply/reaction
2. **Message ID:** Simpan `wa_message_id` dari setiap response untuk testing lanjutan
3. **Variables:** Gunakan Postman variables untuk efficiency testing
4. **Logs:** Monitor server logs untuk debug issues
5. **Timeout:** Reply/reaction harus dalam 24 jam window dari original message

---

**Happy Testing! 🎉**

Jika ada pertanyaan atau issue, check documentation lengkap di file-file yang sudah disediakan.
