# WhatsApp Business Cloud API - Webhook Coverage

## Overview
Webhook endpoint: `POST /webhook/whatsapp`

Webhook ini sudah mampu menerima **SEMUA** jenis payload yang dikirim oleh WhatsApp Business Cloud API dan memetakannya ke database `messages` table.

---

## ✅ Supported Message Types (17 Types)

### 1. **Text Message** (`text`)
**Payload dari WhatsApp:**
```json
{
  "type": "text",
  "text": {
    "body": "Hello, how can I help?"
  }
}
```

**Mapping ke Database:**
- `user_id`: `null` (customer/incoming)
- `content_type`: `'text'`
- `content_text`: message body
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `reply_to_wa_message_id`: context message ID (if reply)

---

### 2-6. **Media Messages** (`image`, `video`, `audio`, `document`, `sticker`)

**Payload dari WhatsApp:**
```json
{
  "type": "image",
  "image": {
    "id": "media_id_from_whatsapp",
    "mime_type": "image/jpeg",
    "sha256": "hash",
    "caption": "Check this out"
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'media'`
- `content_text`: caption (if exists)
- `media_type`: `'image'` / `'video'` / `'audio'` / `'document'` / `'sticker'`
- `media_id`: WhatsApp media ID
- `mime_type`: MIME type dari media
- `original_filename`: filename (for documents)
- `gcs_filename`: Generated after download
- `gcs_url`: GCS URL after upload
- `file_size`: File size in bytes
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`

**Process Flow:**
1. Receive webhook → Save to DB
2. Download media from WhatsApp → Upload to GCS
3. Update message record with GCS details

---

### 7. **Location Message** (`location`)

**Payload dari WhatsApp:**
```json
{
  "type": "location",
  "location": {
    "latitude": -6.200000,
    "longitude": 106.816666,
    "name": "Office",
    "address": "Jakarta"
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'location'`
- `content_text`: Formatted address
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Full location object

---

### 8. **Contacts Message** (`contacts`)

**Payload dari WhatsApp:**
```json
{
  "type": "contacts",
  "contacts": [
    {
      "name": { "formatted_name": "John Doe" },
      "phones": [{ "phone": "+628123456789" }]
    }
  ]
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'contacts'`
- `content_text`: "[Contact: John Doe]"
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Full contacts array

---

### 9. **Reaction Message** (`reaction`)

**Payload dari WhatsApp:**
```json
{
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.original_message",
    "emoji": "👍"
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'reaction'`
- `content_text`: `null`
- `wa_message_id`: WhatsApp message ID
- `reaction_emoji`: The emoji (e.g., "👍")
- `reaction_to_wa_message_id`: Original message ID
- `status`: `'received'`

---

### 10. **Interactive Message** (`interactive`)

**Payload dari WhatsApp:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "btn_1",
      "title": "Yes"
    }
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'interactive'`
- `content_text`: Button title or list title
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Full interactive object

---

### 11. **Button Message** (`button`)

**Payload dari WhatsApp:**
```json
{
  "type": "button",
  "button": {
    "text": "Click me",
    "payload": "button_1"
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'button'`
- `content_text`: Button text
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Full button object

---

### 12. **Order Message** (`order`)

**Payload dari WhatsApp:**
```json
{
  "type": "order",
  "order": {
    "catalog_id": "123",
    "product_items": [...]
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'order'`
- `content_text`: "[Order with X items]"
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Full order object

---

### 13. **System Message** (`system`)

**Payload dari WhatsApp:**
```json
{
  "type": "system",
  "system": {
    "body": "Customer number changed",
    "type": "customer_changed_number"
  }
}
```

**Handled by:** `systemService.js`
- Customer identity changed
- Customer changed number
- Etc.

---

### 14. **Referral Message** (`referral`)

**Payload dari WhatsApp:**
```json
{
  "type": "referral",
  "referral": {
    "source_type": "ad",
    "source_id": "ad_123",
    "source_url": "https://..."
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'referral'`
- `content_text`: "Referral from ad: ad_123"
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Full referral object

---

### 15. **Unsupported Message** (`unsupported`)

**Payload dari WhatsApp:**
```json
{
  "type": "unsupported",
  "unsupported": {
    "reason": "This message type is not supported"
  }
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'unsupported'`
- `content_text`: "[Unsupported Message Type]"
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: Unsupported details

**Use Case:**
WhatsApp sends ini ketika customer mengirim message type yang tidak bisa diproses (misalnya voice note di WhatsApp versi lama).

---

### 16. **Request Welcome** (`request_welcome`)

**Payload dari WhatsApp:**
```json
{
  "type": "request_welcome"
}
```

**Mapping ke Database:**
- `user_id`: `null`
- `content_type`: `'system'`
- `content_text`: "[Customer clicked Get Started]"
- `wa_message_id`: WhatsApp message ID
- `status`: `'received'`
- `metadata`: `{ type: 'request_welcome' }`

**Use Case:**
Ketika customer klik tombol "Get Started" di chat pertama kali.

---

### 17. **Unknown Message Types** (Fallback)

Jika WhatsApp mengirim message type yang tidak dikenali:

```javascript
default:
  logger.warn({ type, message }, 'Unknown message type received');
  return { 
    type: 'unknown_message', 
    success: false,
    error: `Unknown message type: ${type}`,
    room_id: roomId,
    wa_message_id
  };
```

**Behavior:**
- Log warning dengan detail payload
- Return error response
- **Tidak crash** webhook
- Message tidak disimpan ke database (by design)

---

## 📊 Message Status Updates

Webhook juga handle **status updates** untuk outgoing messages:

### Status Types:
1. **`sent`** - Message terkirim ke WhatsApp
2. **`delivered`** - Message delivered ke customer device
3. **`read`** - Customer sudah baca message
4. **`failed`** - Message gagal terkirim

**Payload dari WhatsApp:**
```json
{
  "statuses": [{
    "id": "wamid.message_id",
    "status": "read",
    "timestamp": "1234567890"
  }]
}
```

**Handled by:** `statusService.js`
- Update `status` column di messages table
- Update `status_timestamp`
- Emit socket event `message_status_update`

---

## 🔄 Schema Mapping Summary

| WhatsApp Field | Database Column | Notes |
|----------------|----------------|-------|
| `from` | - | Used to identify/create room |
| `id` | `wa_message_id` | WhatsApp message ID |
| `type` | `content_type` | Message type |
| `text.body` | `content_text` | Text content |
| `image/video/etc` | `media_type` | Media category |
| `image.id` | `media_id` | WhatsApp media ID |
| `image.mime_type` | `mime_type` | MIME type |
| `context.id` | `reply_to_wa_message_id` | Reply to message |
| `reaction.emoji` | `reaction_emoji` | Emoji reaction |
| `reaction.message_id` | `reaction_to_wa_message_id` | Reacted message |
| - | `user_id` | `null` for customer, `uuid` for agent |
| `timestamp` | `created_at` | Message timestamp |

---

## 🛡️ Error Handling

### 1. **Unknown Message Types**
- Logged with full payload
- Webhook tetap return 200 OK
- Tidak crash server

### 2. **Missing Required Fields**
- Validation di `ensureRoom()`
- Validation di message handlers
- Error logged dan returned

### 3. **Media Download Failures**
- Message tetap tersimpan ke DB
- Media diproses async
- Retry mechanism in place

### 4. **Database Errors**
- Transaction rollback
- Error logged
- Webhook return 500

---

## 🚀 Real-time Updates

Setiap incoming message trigger Socket.IO event:

```javascript
io.to(`room_${room_id}`).emit('new_message', savedMessage);
```

**Frontend listeners:**
- `new_message` - New incoming message
- `message_status_update` - Status update (delivered/read)
- `typing_indicator` - Customer typing

---

## ✅ Validation Checklist

- [x] Text messages
- [x] Image messages (with caption)
- [x] Video messages
- [x] Audio messages
- [x] Document messages
- [x] Sticker messages
- [x] Location messages
- [x] Contact messages
- [x] Reaction messages
- [x] Interactive button replies
- [x] Interactive list replies
- [x] Button messages
- [x] Order messages
- [x] System messages
- [x] Referral messages (ads, posts)
- [x] Unsupported message types
- [x] Request welcome (Get Started)
- [x] Unknown types fallback
- [x] Message status updates
- [x] Reply/Context handling
- [x] Media download & GCS upload
- [x] Real-time Socket.IO events
- [x] Error handling & logging

---

## 📚 References

- [WhatsApp Business Cloud API - Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Message Types](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
- [Media Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)

---

## 🎯 Conclusion

**Webhook sudah LENGKAP** dan mampu handle:
- ✅ Semua message types dari WhatsApp Business Cloud API
- ✅ Status updates (sent, delivered, read, failed)
- ✅ Context/Reply messages
- ✅ Reactions
- ✅ Media dengan auto-download & GCS upload
- ✅ Unknown types dengan graceful fallback
- ✅ Real-time updates via Socket.IO
- ✅ Proper error handling tanpa crash

**Database mapping sudah SESUAI** dengan struktur table `messages`:
- user_id (null = customer)
- content_type & content_text
- Media fields (media_type, media_id, gcs_url, etc)
- WhatsApp IDs (wa_message_id)
- Reply & Reaction fields
- Status & timestamps
