# 📮 Testing Guide - WhatsApp Business API

## 🎯 **PERBEDAAN PENTING:**

### **1. Webhook Endpoint (MENERIMA pesan):**
```
POST /webhook/whatsapp
```
**Fungsi:** Menerima notifikasi dari WhatsApp ketika ada user kirim pesan KE nomor business kamu.
**Test di Postman:** Simulasi webhook dari WhatsApp Graph API
**Hasil:** Pesan tersimpan di database, TIDAK muncul di HP kamu

### **2. Send Message Endpoint (MENGIRIM pesan):**
```
POST /messages/send
POST /messages/test
```
**Fungsi:** Mengirim pesan DARI nomor business kamu KE user lain
**Test di Postman:** Kirim pesan ke nomor HP target
**Hasil:** Pesan muncul di HP target (kalau nomor valid dan authorized)

## 🧪 **Testing Flow yang BENAR:**

### **A. Test Incoming Message (Webhook Simulation):**
```json
POST /webhook/whatsapp
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "2569770200040122",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551466180",
          "phone_number_id": "688261591046101"
        },
        "contacts": [{
          "profile": { "name": "Test User" },
          "wa_id": "6287879565390"
        }],
        "messages": [{
          "from": "6287879565390",
          "id": "wamid.test_" + Date.now(),
          "timestamp": "1724572800",
          "text": { "body": "Hello dari user ke business!" },
          "type": "text"
        }]
      }
    }]
  }]
}
```
**Expected Result:**
- ✅ Status 200 dengan response detail
- ✅ Pesan tersimpan di database
- ✅ Socket.io emit ke room
- ❌ TIDAK muncul di HP (karena ini simulasi)

### **B. Test Outgoing Message (Kirim ke WhatsApp REAL):**
```json
POST /messages/test
{
  "to": "628123456789"
}
```
**Expected Result:**
- ✅ Status 200 dengan WhatsApp message ID
- ✅ Pesan MUNCUL di HP nomor target
- ✅ Graph API dipanggil untuk kirim pesan

### **C. Test Custom Outgoing Message:**
```json
POST /messages/send
{
  "to": "628123456789",
  "text": "Hello dari Boztell Backend!",
  "type": "text"
}
```

## 🔧 **Environment Variables yang Diperlukan:**
```
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=688261591046101
WHATSAPP_VERIFY_TOKEN=skor123
```

## 📱 **Untuk Test di HP Kamu:**

1. **Ganti nomor target** di test menjadi nomor HP kamu:
   ```json
   {
     "to": "6287879565390"  // Ganti dengan nomor HP kamu
   }
   ```

2. **Pastikan nomor diformat benar:** `628xxxxxxxxx` (tanpa +, tanpa 0)

3. **Test dengan endpoint `/messages/test`** dulu untuk coba kirim pesan

## 🚨 **Common Issues:**

### **"Pesan tidak muncul di HP"**
- Cek nomor format: `628xxxxxxxxx`
- Pastikan ACCESS_TOKEN valid
- Cek nomor authorized untuk testing
- Lihat error di log server

### **"Webhook return 200 tapi tidak ada effect"**
- Normal! Webhook cuma simulasi
- Cek database apakah pesan tersimpan
- Untuk test real, pakai `/messages/send`

### **"Graph API error"**
- Cek environment variables
- Pastikan access token tidak expired
- Cek phone number ID benar

Ready untuk test? Mari coba endpoint `/messages/test` dulu! 🚀
