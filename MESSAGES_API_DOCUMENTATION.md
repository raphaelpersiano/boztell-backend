# Messages API Documentation

## Overview
API untuk mengirim berbagai jenis pesan melalui WhatsApp Business API. Semua endpoint menggunakan field `user_id` untuk menandakan pesan dikirim oleh user mana (agent). Jika `user_id` null, berarti pesan dari customer.

## Base URL
```
http://localhost:8080/messages
```

## Authentication
Saat ini belum ada authentication required, tapi pastikan server backend sudah running.

## Field `user_id` 
- **Type**: String (UUID format) atau null
- **Required**: Optional 
- **Description**: 
  - Jika diisi: Harus UUID yang valid dari table `users` (agent message)
  - Jika kosong/null: Message dianggap dari customer
- **Format**: `"d19273b4-e459-4808-ae5a-cf7ec97ef143"`

---

## 1. Send Text Message

### Endpoint
```
POST /messages/send
```

### Payload Body
```json
{
  "to": "6287879565390",
  "text": "Hello from agent!",
  "type": "text",
  "user_id": "d19273b4-e459-4808-ae5a-cf7ec97ef143",
  "replyTo": "wamid.xxx" // optional - untuk reply message
}
```

### Response Success
```json
{
  "success": true,
  "to": "6287879565390",
  "type": "text",
  "message_id": "123e4567-e89b-12d3-a456-426614174000",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "result": {
    "messaging_product": "whatsapp",
    "contacts": [...],
    "messages": [...]
  }
}
```

### Response Error
```json
{
  "error": "Missing required fields: to, text",
  "message": "Validation error message"
}
```

---

## 2. Send Template Message

### Endpoint
```
POST /messages/send-template
```

### Payload Body
```json
{
  "to": "6287879565390",
  "templateName": "hello_world",
  "languageCode": "en_US",
  "parameters": [], // optional - untuk template dengan parameter
  "user_id": "d19273b4-e459-4808-ae5a-cf7ec97ef143"
}
```

### Payload Body (dengan parameter)
```json
{
  "to": "6287879565390",
  "templateName": "welcome_message", 
  "languageCode": "en_US",
  "parameters": ["John Doe", "Premium Package", "2024"],
  "user_id": "d19273b4-e459-4808-ae5a-cf7ec97ef143"
}
```

### Response Success
```json
{
  "success": true,
  "to": "6287879565390",
  "templateName": "hello_world",
  "languageCode": "en_US",
  "parameters": [],
  "message_id": "123e4567-e89b-12d3-a456-426614174000",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "database_saved": {
    "message_id": "123e4567-e89b-12d3-a456-426614174000",
    "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
    "room_id": "7e956fc9-d64b-4e77-9fd5-1cafc1588b41"
  },
  "result": {...}
}
```

---

## 3. Send Contacts

### Endpoint
```
POST /messages/send-contacts
```

### Payload Body
```json
{
  "to": "6287879565390",
  "contacts": [
    {
      "name": {
        "first_name": "John",
        "last_name": "Doe"
      },
      "phones": [
        {
          "phone": "+1234567890",
          "type": "MOBILE"
        }
      ],
      "emails": [
        {
          "email": "john@example.com",
          "type": "WORK"
        }
      ]
    }
  ],
  "user_id": "d19273b4-e459-4808-ae5a-cf7ec97ef143",
  "replyTo": "wamid.xxx" // optional
}
```

### Response Success
```json
{
  "success": true,
  "to": "6287879565390",
  "type": "contacts",
  "message_id": "123e4567-e89b-12d3-a456-426614174000",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "result": {...}
}
```

---

## 4. Send Location

### Endpoint
```
POST /messages/send-location
```

### Payload Body
```json
{
  "to": "6287879565390",
  "location": {
    "latitude": -6.200000,
    "longitude": 106.816666,
    "name": "Jakarta",
    "address": "Jakarta, Indonesia"
  },
  "user_id": "d19273b4-e459-4808-ae5a-cf7ec97ef143",
  "replyTo": "wamid.xxx" // optional
}
```

### Response Success
```json
{
  "success": true,
  "to": "6287879565390",
  "type": "location",
  "message_id": "123e4567-e89b-12d3-a456-426614174000",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "result": {...}
}
```

---

## 5. Send Reaction

### Endpoint
```
POST /messages/send-reaction
```

### Payload Body
```json
{
  "to": "6287879565390",
  "message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "emoji": "👍",
  "user_id": "d19273b4-e459-4808-ae5a-cf7ec97ef143"
}
```

### Response Success
```json
{
  "success": true,
  "to": "6287879565390",
  "type": "reaction",
  "message_id": "123e4567-e89b-12d3-a456-426614174000",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "result": {...}
}
```

---

## 6. Upload and Send Media (Combined)

### Endpoint
```
POST /messages/send-media-combined
```

### Payload Body (Form Data)
```
Content-Type: multipart/form-data

media: [FILE] // Required - file upload
to: "6287879565390" // Required
caption: "Check this image!" // Optional
user_id: "d19273b4-e459-4808-ae5a-cf7ec97ef143" // Optional
```

### Supported Media Types
- **Image**: `image/jpeg`, `image/png`, `image/webp`
- **Video**: `video/mp4`, `video/3gpp`
- **Audio**: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`, `audio/ogg`
- **Document**: `application/pdf`, `application/msword`, etc.

### Response Success
```json
{
  "success": true,
  "to": "6287879565390",
  "mediaType": "image",
  "filename": "photo.jpg",
  "size": 1024000,
  "message_id": "123e4567-e89b-12d3-a456-426614174000",
  "whatsapp_media_id": "media123456",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  "storage_url": "https://storage.googleapis.com/bucket/path/to/file",
  "storage_filename": "whatsapp-media/6287879565390/2024/10/photo.jpg",
  "caption_handling": {
    "caption_provided": true,
    "caption_supported_by_media_type": true,
    "separate_text_message_sent": false,
    "separate_text_message_id": null,
    "note": null
  }
}
```

### Caption Handling
- **Image & Video**: Caption langsung muncul di WhatsApp
- **Audio**: Caption diabaikan (tidak support)
- **Document**: Caption otomatis dikirim sebagai pesan text terpisah

---

## 10. Get Available Templates

### Endpoint
```
GET /messages/templates
```

### Response Success
```json
{
  "success": true,
  "templates": [
    {
      "name": "hello_world",
      "language": "en_US",
      "status": "APPROVED",
      "category": "UTILITY",
      "components": [
        {
          "type": "BODY",
          "text": "Hello World",
          "parameters": []
        }
      ]
    }
  ],
  "total": 5,
  "usage_example": {...}
}
```

---

## 12. Verify Message in Database

### Endpoint
```
GET /messages/verify/{messageId}
```

### Response Success
```json
{
  "success": true,
  "message_found": true,
  "message": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "room_id": "7e956fc9-d64b-4e77-9fd5-1cafc1588b41",
    "content_type": "text",
    "content_text": "Hello message",
    "wa_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
    "metadata": {...},
    "created_at": "2025-10-19T17:13:11.255+00:00",
    "updated_at": "2025-10-19T17:13:12.589852+00:00"
  },
  "whatsapp_message_id_saved": true,
  "database_check": "Message found and WhatsApp message ID is saved"
}
```

### Response Not Found
```json
{
  "error": "Message not found in database",
  "message_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields: to, text"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to send message",
  "message": "Detailed error message",
  "message_id": "123e4567-e89b-12d3-a456-426614174000"
}
```