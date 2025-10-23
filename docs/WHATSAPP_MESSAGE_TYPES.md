# WhatsApp Message Types Support

## ✅ Fully Supported Message Types

Backend supports **ALL** WhatsApp Business API message types with complete webhook handling and real-time Socket.IO emission.

### 1. **Text Messages** 📝
- **Type:** `text`
- **Webhook Handler:** `handleTextMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'text'`, `content_text: <message>`
- **Features:**
  - ✅ Reply support (context)
  - ✅ Auto-reply logic
  - ✅ Real-time emission
  - ✅ Push notifications

**Example Payload:**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "text",
  "content_text": "Hello, how can I help?",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "reply_to_wa_message_id": null,
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 2. **Media Messages** 🖼️🎥🎵📄
- **Types:** `image`, `video`, `audio`, `document`, `sticker`
- **Webhook Handler:** `handleMediaMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'media'`, media fields populated
- **Features:**
  - ✅ Auto-download from WhatsApp API
  - ✅ Upload to Google Cloud Storage
  - ✅ Public URL generation
  - ✅ Thumbnail generation (for images/videos)
  - ✅ Caption support
  - ✅ File metadata (size, mime type, filename)
  - ✅ Real-time emission with `media_url`

**Supported Media Types:**
- **Image:** JPEG, PNG, GIF, WebP
- **Video:** MP4, 3GP
- **Audio:** AAC, M4A, AMR, MP3, OGG
- **Document:** PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
- **Sticker:** WebP animated stickers

**Example Payload:**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "media",
  "content_text": "Check out this photo!",
  "media_type": "image",
  "media_id": "wa-media-id-xxx",
  "gcs_filename": "whatsapp-media/628xxx/image_123.jpg",
  "gcs_url": "https://storage.googleapis.com/...",
  "file_size": 245678,
  "mime_type": "image/jpeg",
  "original_filename": "photo.jpg",
  "media_url": "https://storage.googleapis.com/...",
  "thumbnail_url": "https://storage.googleapis.com/.../thumb_xxx.jpg",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 3. **Location Messages** 📍
- **Type:** `location`
- **Webhook Handler:** `handleLocationMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'location'`, location data in metadata
- **Features:**
  - ✅ Latitude/Longitude
  - ✅ Location name
  - ✅ Address
  - ✅ Real-time emission

**Example Payload:**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "location",
  "content_text": "Monas: -6.1753924, 106.8271528",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "metadata": {
    "location": {
      "latitude": -6.1753924,
      "longitude": 106.8271528,
      "name": "Monas",
      "address": "Jakarta Pusat, Indonesia"
    }
  },
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 4. **Contact Sharing** 👤
- **Type:** `contacts`
- **Webhook Handler:** `handleContactsMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'contacts'`, contacts array in metadata
- **Features:**
  - ✅ Multiple contacts support
  - ✅ Name, phone, email
  - ✅ Real-time emission

**Example Payload:**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "contacts",
  "content_text": "Shared contacts: John Doe, Jane Smith",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "metadata": {
    "contacts": [
      {
        "name": { "formatted_name": "John Doe" },
        "phones": [{ "phone": "+6281234567890" }]
      }
    ]
  },
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 5. **Reactions** ❤️👍😂
- **Type:** `reaction`
- **Webhook Handler:** `handleReactionMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'reaction'`, `reaction_emoji` + `reaction_to_wa_message_id`
- **Features:**
  - ✅ Emoji reactions
  - ✅ Reference to original message
  - ✅ Remove reaction (empty emoji)
  - ✅ Real-time emission

**Example Payload:**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "reaction",
  "content_text": "Reacted ❤️ to message",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "reaction_emoji": "❤️",
  "reaction_to_wa_message_id": "wamid.original-message",
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 6. **Interactive Messages** 🔘📋
- **Type:** `interactive`
- **Subtypes:** `button_reply`, `list_reply`
- **Webhook Handler:** `handleInteractiveMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'interactive'`, response data in metadata
- **Features:**
  - ✅ Button clicks
  - ✅ List selections
  - ✅ Response ID and title
  - ✅ Real-time emission

**Example Payload (Button Reply):**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "interactive",
  "content_text": "Button clicked: Yes, I'm interested",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "metadata": {
    "interactive": {
      "button_reply": {
        "id": "btn_yes",
        "title": "Yes, I'm interested"
      }
    }
  },
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 7. **Button Messages (Legacy)** 🔳
- **Type:** `button`
- **Webhook Handler:** `handleButtonMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'button'`
- **Features:**
  - ✅ Legacy button support
  - ✅ Real-time emission

---

### 8. **Order Messages** 🛒
- **Type:** `order`
- **Webhook Handler:** `handleOrderMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'order'`, order details in metadata
- **Features:**
  - ✅ Product items
  - ✅ Order details
  - ✅ Real-time emission

**Example Payload:**
```json
{
  "id": "uuid-xxx",
  "room_id": "uuid-yyy",
  "user_id": null,
  "content_type": "order",
  "content_text": "Order placed with 3 items",
  "wa_message_id": "wamid.xxx",
  "status": "received",
  "metadata": {
    "order": {
      "product_items": [...],
      "total": "150000"
    }
  },
  "created_at": "2025-10-23T12:00:00Z"
}
```

---

### 9. **Referral Messages** 🔗
- **Type:** `referral`
- **Webhook Handler:** `handleReferralMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'referral'`
- **Features:**
  - ✅ Source tracking (ads, post, etc.)
  - ✅ Real-time emission

---

### 10. **System Messages** ⚙️
- **Type:** `system`, `request_welcome`
- **Webhook Handler:** `handleSystemEvent()`, `handleRequestWelcome()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'system'`
- **Features:**
  - ✅ "Get Started" button clicks
  - ✅ Customer status changes
  - ✅ Real-time emission

---

### 11. **Unsupported Messages** ⚠️
- **Type:** `unsupported`
- **Webhook Handler:** `handleUnsupportedMessage()`
- **Socket.IO Event:** `new_message`
- **Database:** `content_type: 'unsupported'`
- **Features:**
  - ✅ Graceful handling of unknown types
  - ✅ Real-time emission

---

## 📡 Socket.IO Event Structure

**ALL** message types emit with the **same consistent structure**:

```typescript
socket.on('new_message', (message) => {
  // Message object with ALL database fields at top level
  console.log(message.id);              // ✅ Always present
  console.log(message.room_id);         // ✅ Always present
  console.log(message.user_id);         // null = customer, uuid = agent
  console.log(message.content_type);    // text|media|location|contacts|etc
  console.log(message.content_text);    // Main text content
  console.log(message.wa_message_id);   // WhatsApp message ID
  console.log(message.status);          // received|sent|delivered|read|failed
  
  // Media-specific (if content_type === 'media')
  console.log(message.media_type);      // image|video|audio|document|sticker
  console.log(message.media_url);       // Public GCS URL
  console.log(message.gcs_url);         // GCS URL
  console.log(message.file_size);       // File size in bytes
  console.log(message.mime_type);       // MIME type
  console.log(message.original_filename); // Original filename
  
  // Additional fields
  console.log(message.reply_to_wa_message_id);     // Reply context
  console.log(message.reaction_emoji);              // Reaction emoji
  console.log(message.reaction_to_wa_message_id);  // Reaction target
  console.log(message.metadata);                    // Type-specific data
  console.log(message.created_at);                  // Timestamp
});
```

---

## 🔄 Message Flow

### Incoming (Customer → Backend)
1. Customer sends WhatsApp message
2. WhatsApp API → POST `/webhook/whatsapp`
3. `routeWhatsAppWebhook()` routes to specific handler
4. Handler processes and calls `handleIncomingMessage()` or `handleIncomingMedia()`
5. Save to database (Supabase)
6. Emit `new_message` Socket.IO event (direct message object)
7. Frontend receives real-time update
8. Send push notifications to agents

### Outgoing (Agent → Customer)
1. Agent types message in frontend
2. Frontend → POST `/messages/send`
3. Backend sends to WhatsApp API first
4. Save to database with `wa_message_id`
5. Emit `new_message` Socket.IO event (direct message object)
6. Frontend shows message immediately (optimistic UI)

---

## ✅ Complete Coverage Matrix

| Message Type | Webhook ✓ | Database ✓ | Socket.IO ✓ | Push Notification ✓ |
|--------------|-----------|------------|-------------|---------------------|
| Text         | ✅        | ✅         | ✅          | ✅                  |
| Image        | ✅        | ✅         | ✅          | ✅                  |
| Video        | ✅        | ✅         | ✅          | ✅                  |
| Audio        | ✅        | ✅         | ✅          | ✅                  |
| Document     | ✅        | ✅         | ✅          | ✅                  |
| Sticker      | ✅        | ✅         | ✅          | ✅                  |
| Location     | ✅        | ✅         | ✅          | ✅                  |
| Contacts     | ✅        | ✅         | ✅          | ✅                  |
| Reaction     | ✅        | ✅         | ✅          | ✅                  |
| Interactive  | ✅        | ✅         | ✅          | ✅                  |
| Button       | ✅        | ✅         | ✅          | ✅                  |
| Order        | ✅        | ✅         | ✅          | ✅                  |
| Referral     | ✅        | ✅         | ✅          | ✅                  |
| System       | ✅        | ✅         | ✅          | ✅                  |
| Unsupported  | ✅        | ✅         | ✅          | ✅                  |

**Total: 15 message types fully supported** 🎉

---

## 🧪 Testing

Test each message type by:
1. Send message from WhatsApp to your business number
2. Check backend logs for `📡 Emitting new_message events`
3. Verify frontend receives message via Socket.IO
4. Confirm message appears in chat window
5. Check database has correct `content_type` and fields

All message types will work seamlessly! 🚀
