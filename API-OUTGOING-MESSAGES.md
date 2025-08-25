# Boztell WhatsApp Backend - Outgoing Messages API Documentation

## Overview
Dokumentasi ini menjelaskan cara mengirim pesan keluar (outgoing messages) melalui Boztell WhatsApp Backend API, termasuk pesan dengan location, reaction, dan reply.

## Base URL
```
http://localhost:8080
```

## Authentication
Tidak ada authentication khusus untuk development. Pastikan environment variables sudah dikonfigurasi dengan benar.

---

## 1. Basic Text Messages

### Send Custom Text Message
Mengirim pesan teks kustom ke nomor WhatsApp.

**Endpoint:** `POST /messages/send`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "15559876543",
  "text": "Hello! This is a custom message from Boztell Backend 🚀",
  "type": "text"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "wamid.xxx",
  "wa_message_id": "wamid.xxx"
}
```

---

## 2. Location Messages

### Send Location Message
Mengirim pesan lokasi dengan koordinat, nama, dan alamat.

**Endpoint:** `POST /messages/send`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "15559876543",
  "type": "location",
  "location": {
    "latitude": -6.2088,
    "longitude": 106.8456,
    "name": "Monas",
    "address": "Jl. Silang Monas, Gambir, Kota Jakarta Pusat, DKI Jakarta 10110"
  }
}
```

**Parameters:**
- `latitude` (number, required): Koordinat latitude
- `longitude` (number, required): Koordinat longitude  
- `name` (string, optional): Nama lokasi
- `address` (string, optional): Alamat lengkap lokasi

**Response:**
```json
{
  "success": true,
  "message_id": "wamid.xxx",
  "wa_message_id": "wamid.xxx"
}
```

**Example dengan lokasi berbeda:**
```json
{
  "to": "15559876543",
  "type": "location",
  "location": {
    "latitude": -6.1751,
    "longitude": 106.8650,
    "name": "Grand Indonesia Mall",
    "address": "Jl. M.H. Thamrin No.1, Menteng, Jakarta Pusat"
  }
}
```

---

## 3. Reply Messages

### Send Reply to Message
Membalas pesan yang sudah ada dengan menggunakan context message ID.

**Endpoint:** `POST /messages/send`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "15559876543",
  "text": "This is a reply to your previous message",
  "type": "text",
  "context": {
    "message_id": "wamid.original_message_id_here"
  }
}
```

**Parameters:**
- `context.message_id` (string, required): ID pesan WhatsApp yang akan di-reply (wa_message_id dari pesan sebelumnya)
- `text` (string, required): Isi pesan reply
- `type` (string): Harus "text" untuk reply

**Response:**
```json
{
  "success": true,
  "message_id": "wamid.xxx",
  "wa_message_id": "wamid.xxx",
  "context": {
    "message_id": "wamid.original_message_id_here"
  }
}
```

**Cara mendapatkan message_id untuk reply:**
1. Kirim pesan pertama dan catat `wa_message_id` dari response
2. Gunakan `wa_message_id` tersebut sebagai `context.message_id` dalam reply

**Example lengkap:**
```json
{
  "to": "15559876543",
  "text": "Terima kasih atas pertanyaannya! Ini adalah balasan dari tim support.",
  "type": "text",
  "context": {
    "message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA"
  }
}
```

---

## 4. Reaction Messages

### Send Reaction to Message
Memberikan emoji reaction ke pesan yang sudah ada.

**Endpoint:** `POST /messages/send`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.original_message_id_here",
    "emoji": "👍"
  }
}
```

**Parameters:**
- `reaction.message_id` (string, required): ID pesan WhatsApp yang akan diberi reaction
- `reaction.emoji` (string, required): Emoji yang akan digunakan sebagai reaction

**Supported Emojis:**
- 👍 (thumbs up)
- 👎 (thumbs down)
- ❤️ (heart)
- 😂 (laughing)
- 😮 (surprised)
- 😢 (sad)
- 😡 (angry)
- 🙏 (pray)

**Response:**
```json
{
  "success": true,
  "message_id": "wamid.xxx",
  "wa_message_id": "wamid.xxx",
  "reaction": {
    "message_id": "wamid.original_message_id_here",
    "emoji": "👍"
  }
}
```

**Example dengan berbagai emoji:**
```json
{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA",
    "emoji": "❤️"
  }
}
```

### Remove Reaction
Untuk menghapus reaction, gunakan emoji kosong:
```json
{
  "to": "15559876543",
  "type": "reaction", 
  "reaction": {
    "message_id": "wamid.original_message_id_here",
    "emoji": ""
  }
}
```

---

## 5. Media Messages dengan Context

### Send Media with Reply
Mengirim media sambil membalas pesan sebelumnya.

**Endpoint:** `POST /messages/send-media-file`

**Form Data:**
- `media` (file): File media yang akan dikirim
- `to` (text): Nomor tujuan
- `caption` (text, optional): Caption untuk media
- `context_message_id` (text, optional): ID pesan yang akan di-reply

**Example dengan curl:**
```bash
curl -X POST http://localhost:8080/messages/send-media-file \
  -F "media=@/path/to/image.jpg" \
  -F "to=15559876543" \
  -F "caption=Here's the image you requested!" \
  -F "context_message_id=wamid.original_message_id_here"
```

---

## 6. Template Messages

### Send Template Message
Mengirim template message yang sudah disetujui WhatsApp.

**Endpoint:** `POST /messages/send`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "15559876543",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "en"
    },
    "components": []
  }
}
```

---

## 7. Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "error": "Missing required parameter: to",
  "success": false
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to send message to WhatsApp",
  "success": false,
  "details": "Error details here"
}
```

---

## 8. Testing Workflow

### Workflow untuk Testing Reply dan Reaction

1. **Kirim pesan pertama:**
```json
POST /messages/send
{
  "to": "15559876543",
  "text": "Pesan pertama untuk testing reply dan reaction",
  "type": "text"
}
```

2. **Catat wa_message_id dari response:**
```json
{
  "success": true,
  "wa_message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA"
}
```

3. **Kirim reply:**
```json
POST /messages/send
{
  "to": "15559876543",
  "text": "Ini adalah reply ke pesan pertama",
  "type": "text",
  "context": {
    "message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA"
  }
}
```

4. **Kirim reaction:**
```json
POST /messages/send
{
  "to": "15559876543",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAEhggRDQwQzZCQTZEMzU4NDdBQkJCMDIwMkEwMTk0M0YxMDUA",
    "emoji": "👍"
  }
}
```

---

## 9. Postman Collection Variables

Untuk testing dengan Postman, gunakan variables berikut:

```json
{
  "baseUrl": "http://localhost:8080",
  "testPhoneNumber": "15559876543",
  "sampleLatitude": -6.2088,
  "sampleLongitude": 106.8456,
  "sampleLocationName": "Monas Jakarta",
  "sampleLocationAddress": "Jl. Silang Monas, Gambir, Jakarta Pusat",
  "reactionEmoji": "👍",
  "repliedWaMessageId": "{{wa_message_id_from_previous_request}}",
  "reactionTargetWaMessageId": "{{wa_message_id_from_previous_request}}"
}
```

---

## 10. Notes

- Pastikan nomor WhatsApp tujuan sudah terdaftar dan aktif
- Untuk testing, gunakan nomor yang sudah diverifikasi di WhatsApp Business API
- Message ID harus valid dan berasal dari conversation yang sama
- Emoji reaction harus menggunakan Unicode yang didukung WhatsApp
- Location coordinates harus menggunakan format decimal degrees

---

## Support

Jika ada error atau pertanyaan, check:
1. Console logs di terminal server
2. Database logs untuk message tracking
3. WhatsApp Business API webhook logs
