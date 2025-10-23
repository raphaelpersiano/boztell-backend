# Backend API Contract: Message Display Guide

## 📡 Real-time Events (Socket.IO)

### Event: `new_message`

**Description:** Fired setiap kali ada message baru (dari customer via WhatsApp atau dari agent via dashboard)

**Payload Structure:**
```json
{
  "id": "uuid-string",
  "room_id": "uuid-string",
  "user_id": "uuid-string | null",
  "content_type": "text|media|location|contacts|reaction|interactive|button|order|system|referral|unsupported",
  "content_text": "string | null",
  "wa_message_id": "string | null",
  "status": "sent|delivered|read|failed|received | null",
  "status_timestamp": "ISO8601 timestamp | null",
  "media_type": "image|video|audio|document|sticker | null",
  "media_id": "string | null",
  "gcs_filename": "string | null",
  "gcs_url": "string | null",
  "file_size": "number | null",
  "mime_type": "string | null",
  "original_filename": "string | null",
  "reply_to_wa_message_id": "string | null",
  "reaction_emoji": "string | null",
  "reaction_to_wa_message_id": "string | null",
  "metadata": "object | null",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp"
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ Yes | Primary key dari database |
| `room_id` | UUID | ✅ Yes | Room/chat tempat message ini berada |
| `user_id` | UUID \| null | ✅ Yes | `null` = customer, `uuid` = agent |
| `content_type` | string | ✅ Yes | Tipe message (lihat tabel di bawah) |
| `content_text` | string \| null | ✅ Yes | Text utama atau caption |
| `wa_message_id` | string \| null | ✅ Yes | WhatsApp message ID (null untuk agent messages) |
| `status` | string \| null | ✅ Yes | Status delivery message |
| `status_timestamp` | string \| null | ✅ Yes | Kapan status terakhir update |
| `media_type` | string \| null | ✅ Yes | Sub-type media (jika `content_type = "media"`) |
| `media_id` | string \| null | ✅ Yes | WhatsApp media ID |
| `gcs_filename` | string \| null | ✅ Yes | Filename di Google Cloud Storage |
| `gcs_url` | string \| null | ✅ Yes | **PUBLIC URL** untuk download/display media |
| `file_size` | number \| null | ✅ Yes | Ukuran file dalam bytes |
| `mime_type` | string \| null | ✅ Yes | MIME type (e.g., `image/jpeg`) |
| `original_filename` | string \| null | ✅ Yes | Nama file asli |
| `reply_to_wa_message_id` | string \| null | ✅ Yes | Message ID yang di-reply |
| `reaction_emoji` | string \| null | ✅ Yes | Emoji reaction (e.g., `❤️`) |
| `reaction_to_wa_message_id` | string \| null | ✅ Yes | Message ID yang di-reaction |
| `metadata` | object \| null | ✅ Yes | Data tambahan (struktur berbeda per type) |
| `created_at` | string | ✅ Yes | Timestamp created (ISO8601) |
| `updated_at` | string | ✅ Yes | Timestamp updated (ISO8601) |

**⚠️ IMPORTANT:**
- Semua field **ALWAYS present** (tidak akan missing/undefined)
- Field yang tidak ada value akan bernilai `null` (bukan `undefined` atau empty string)
- Frontend **MUST validate** `id`, `room_id`, `content_type` ada sebelum render

---

## 📋 Message Types Reference

### 1. Text Message (`content_type: "text"`)

**Identifikasi:**
```json
{
  "content_type": "text",
  "content_text": "Hello, I need help!"
}
```

**Display Requirements:**
- Show `content_text` as plain text
- Support text wrapping
- Optionally parse WhatsApp formatting: `*bold*`, `_italic_`, `~strike~`

---

### 2. Media Messages (`content_type: "media"`)

**Sub-types:** Cek field `media_type`

#### 2.1 Image (`media_type: "image"`)

```json
{
  "content_type": "media",
  "media_type": "image",
  "gcs_url": "https://storage.googleapis.com/bucket/image.jpg",
  "content_text": "Photo caption",
  "file_size": 245678,
  "mime_type": "image/jpeg",
  "original_filename": "photo.jpg"
}
```

**Display Requirements:**
- Display image from `gcs_url`
- Show `content_text` as caption (if not null)
- Show `original_filename` and `file_size` (optional)
- Provide download button

#### 2.2 Video (`media_type: "video"`)

```json
{
  "content_type": "media",
  "media_type": "video",
  "gcs_url": "https://storage.googleapis.com/bucket/video.mp4",
  "content_text": "Video caption",
  "mime_type": "video/mp4"
}
```

**Display Requirements:**
- Embed video player dengan `gcs_url`
- Show play button/controls
- Show caption (if not null)

#### 2.3 Audio (`media_type: "audio"`)

```json
{
  "content_type": "media",
  "media_type": "audio",
  "gcs_url": "https://storage.googleapis.com/bucket/audio.ogg",
  "mime_type": "audio/ogg",
  "file_size": 102400
}
```

**Display Requirements:**
- Audio player dengan controls
- Show duration (calculate from file)
- WhatsApp-style voice note UI (optional)

#### 2.4 Document (`media_type: "document"`)

```json
{
  "content_type": "media",
  "media_type": "document",
  "gcs_url": "https://storage.googleapis.com/bucket/report.pdf",
  "original_filename": "Monthly_Report.pdf",
  "file_size": 1024000,
  "mime_type": "application/pdf"
}
```

**Display Requirements:**
- Show file icon (based on extension/MIME type)
- Show `original_filename`
- Show `file_size` (formatted: KB/MB)
- Provide download button
- Link `gcs_url` untuk download

#### 2.5 Sticker (`media_type: "sticker"`)

```json
{
  "content_type": "media",
  "media_type": "sticker",
  "gcs_url": "https://storage.googleapis.com/bucket/sticker.webp",
  "mime_type": "image/webp"
}
```

**Display Requirements:**
- Display sticker image (usually 512x512px)
- No caption

---

### 3. Location Message (`content_type: "location"`)

```json
{
  "content_type": "location",
  "content_text": "Monas: -6.1753924, 106.8271528",
  "metadata": {
    "location": {
      "latitude": -6.1753924,
      "longitude": 106.8271528,
      "name": "Monas",
      "address": "Jakarta Pusat, Indonesia"
    }
  }
}
```

**Metadata Structure:**
```typescript
metadata.location = {
  latitude: number,
  longitude: number,
  name?: string,
  address?: string
}
```

**Display Requirements:**
- Show static map image (Google Maps/Mapbox) dengan pin
- Show `metadata.location.name` (if available)
- Show `metadata.location.address` (if available)
- Show coordinates: `latitude, longitude`
- Link to open in Google Maps: `https://www.google.com/maps?q={lat},{lng}`

---

### 4. Contacts Message (`content_type: "contacts"`)

```json
{
  "content_type": "contacts",
  "content_text": "Shared contacts: John Doe, Jane Smith",
  "metadata": {
    "contacts": [
      {
        "name": { "formatted_name": "John Doe", "first_name": "John", "last_name": "Doe" },
        "phones": [{ "phone": "+6281234567890", "type": "MOBILE" }],
        "emails": [{ "email": "john@example.com", "type": "WORK" }],
        "org": { "company": "Company Inc." }
      }
    ]
  }
}
```

**Metadata Structure:**
```typescript
metadata.contacts = Array<{
  name: {
    formatted_name: string,
    first_name?: string,
    last_name?: string
  },
  phones?: Array<{ phone: string, type?: string, wa_id?: string }>,
  emails?: Array<{ email: string, type?: string }>,
  urls?: Array<{ url: string, type?: string }>,
  addresses?: Array<{ street?: string, city?: string, ... }>,
  org?: { company?: string, department?: string, title?: string },
  birthday?: string
}>
```

**Display Requirements:**
- Loop through `metadata.contacts` array
- Show each contact as card/list item:
  - Name: `name.formatted_name`
  - Phone: `phones[0].phone` (first phone)
  - Email: `emails[0].email` (optional)
  - Company: `org.company` (optional)
- Provide "Add to contacts" or "Call" action

---

### 5. Reaction Message (`content_type: "reaction"`)

```json
{
  "content_type": "reaction",
  "content_text": "Reacted ❤️ to message",
  "reaction_emoji": "❤️",
  "reaction_to_wa_message_id": "wamid.ORIGINAL_MESSAGE_ID"
}
```

**Display Requirements:**
- **DO NOT render as separate bubble**
- Find original message by `reaction_to_wa_message_id`
- Attach reaction badge/emoji on original message bubble
- Show who reacted (based on `user_id`)

**Logic:**
1. Listen to `new_message` dengan `content_type: "reaction"`
2. Find message where `wa_message_id === reaction_to_wa_message_id`
3. Add `reaction_emoji` badge to that message's UI

---

### 6. Interactive Message (`content_type: "interactive"`)

**Button Reply:**
```json
{
  "content_type": "interactive",
  "content_text": "Button clicked: Yes, I'm interested",
  "metadata": {
    "interactive": {
      "button_reply": {
        "id": "btn_yes",
        "title": "Yes, I'm interested"
      }
    }
  }
}
```

**List Reply:**
```json
{
  "content_type": "interactive",
  "content_text": "Selected: Product A",
  "metadata": {
    "interactive": {
      "list_reply": {
        "id": "product_a",
        "title": "Product A",
        "description": "High quality product"
      }
    }
  }
}
```

**Metadata Structure:**
```typescript
metadata.interactive = {
  button_reply?: {
    id: string,
    title: string
  },
  list_reply?: {
    id: string,
    title: string,
    description?: string
  }
}
```

**Display Requirements:**
- Show selected option: `button_reply.title` atau `list_reply.title`
- Highlight dengan border/background berbeda (beda dari text biasa)
- Optional: Show icon (check/list icon)

---

### 7. Button Message (`content_type: "button"`)

```json
{
  "content_type": "button",
  "content_text": "Clicked: Contact Support",
  "metadata": {
    "button": {
      "text": "Contact Support",
      "payload": "support_123"
    }
  }
}
```

**Display Requirements:**
- Similar dengan interactive button
- Show `metadata.button.text`

---

### 8. Order Message (`content_type: "order"`)

```json
{
  "content_type": "order",
  "content_text": "Order placed: 3 items",
  "metadata": {
    "order": {
      "catalog_id": "cat_123",
      "product_items": [
        {
          "product_retailer_id": "prod_001",
          "quantity": 2,
          "item_price": 50000,
          "currency": "IDR"
        }
      ]
    }
  }
}
```

**Display Requirements:**
- Show "Order Message" badge/header
- List products: `product_items` array
- Show quantity, price per item
- Calculate total

---

### 9. Referral Message (`content_type: "referral"`)

```json
{
  "content_type": "referral",
  "content_text": "User came from ad campaign",
  "metadata": {
    "referral": {
      "source_url": "https://fb.com/ad123",
      "source_type": "ad",
      "source_id": "ad_123",
      "headline": "Special Promo 50% Off",
      "body": "Get your discount today!"
    }
  }
}
```

**Display Requirements:**
- Show referral info card
- Display `metadata.referral.headline`
- Display `metadata.referral.body`
- Show source (e.g., "From Facebook Ad")

---

### 10. System Message (`content_type: "system"`)

```json
{
  "content_type": "system",
  "content_text": "Get Started"
}
```

**Display Requirements:**
- Show system message (customer clicked "Get Started" button di WhatsApp)
- Style berbeda dari message biasa (center align, gray text)

---

### 11. Unsupported Message (`content_type: "unsupported"`)

```json
{
  "content_type": "unsupported",
  "content_text": "This message type is not supported"
}
```

**Display Requirements:**
- Show placeholder: "Message type not supported"
- Icon warning/info

---

## 🔄 REST API Endpoints

### GET `/messages/room/:roomId`

**Description:** Fetch historical messages untuk satu room

**Query Parameters:**
- `limit` (optional): Max messages to return (default: 50)
- `offset` (optional): Skip messages (for pagination)
- `order` (optional): `asc` or `desc` (default: `desc`)

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "room_id": "uuid",
      "content_type": "text",
      "content_text": "Hello",
      // ... all fields sama seperti Socket.IO payload
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Usage:**
- Load initial messages saat buka chat room
- Pagination untuk load older messages (infinite scroll)

---

### GET `/rooms`

**Description:** Get list of all rooms/chats

**Query Parameters:**
- `user_id` (optional): Filter rooms by agent/user ID

**Response:**
```json
{
  "rooms": [
    {
      "id": "uuid",
      "phone": "628123456789",
      "title": "Customer Name",
      "last_message": {
        "content_type": "text",
        "content_text": "Last message preview",
        "created_at": "2025-10-23T10:30:00Z"
      },
      "unread_count": 5,
      "participants": [
        { "user_id": "uuid", "name": "Agent Name" }
      ],
      "created_at": "2025-10-23T09:00:00Z",
      "updated_at": "2025-10-23T10:30:00Z"
    }
  ]
}
```

---

### POST `/messages/send`

**Description:** Agent kirim message ke customer via WhatsApp

**Request Body:**
```json
{
  "to": "628123456789",
  "type": "text",
  "text": "Hello, how can I help you?",
  "user_id": "agent-uuid",
  "reply_to": "wamid.REPLY_TO_MESSAGE_ID" // optional
}
```

**Response:**
```json
{
  "success": true,
  "to": "628123456789",
  "type": "text",
  "message_id": "uuid",
  "whatsapp_message_id": "wamid.xxx",
  "result": { /* WhatsApp API response */ }
}
```

**Note:** Setelah send, backend otomatis emit Socket.IO event `new_message` dengan struktur yang sama

---

## 📊 Message Status Flow

### Status Values:
- `sent` - Message terkirim dari agent/customer
- `delivered` - WhatsApp delivered (✓✓)
- `read` - Customer/agent sudah baca (✓✓ biru)
- `failed` - Gagal terkirim
- `received` - Message diterima dari webhook

### Display Logic:
- **Customer messages** (`user_id = null`): Bubble di kiri, background light gray
- **Agent messages** (`user_id = uuid`): Bubble di kanan, background blue

### Status Icons (untuk agent messages):
- `sent`: Single checkmark (✓)
- `delivered`: Double checkmark (✓✓) gray
- `read`: Double checkmark (✓✓) blue
- `failed`: Red X or warning icon

---

## 🎯 Implementation Checklist

### Phase 1: Basic Display
- [ ] Listen to Socket.IO `new_message` event
- [ ] Validate message has `id`, `room_id`, `content_type`
- [ ] Display text messages (`content_type: "text"`)
- [ ] Display message from customer (left) vs agent (right) based on `user_id`
- [ ] Show timestamp (`created_at`)
- [ ] Show status icons (`status`)

### Phase 2: Media Support
- [ ] Display images (`media_type: "image"`) from `gcs_url`
- [ ] Display videos (`media_type: "video"`) dengan player
- [ ] Display audio (`media_type: "audio"`) dengan player
- [ ] Display documents (`media_type: "document"`) dengan download link
- [ ] Display stickers (`media_type: "sticker"`)
- [ ] Show media captions (`content_text`)

### Phase 3: Special Messages
- [ ] Display location messages dengan map preview
- [ ] Display contacts dengan card layout
- [ ] Handle reactions (attach to original message)
- [ ] Display interactive button/list replies
- [ ] Display order messages
- [ ] Display referral messages
- [ ] Display system messages

### Phase 4: Advanced Features
- [ ] Fetch historical messages (GET `/messages/room/:roomId`)
- [ ] Infinite scroll pagination
- [ ] Prevent duplicate messages (check `id`)
- [ ] Reply indicator (if `reply_to_wa_message_id` present)
- [ ] Unread message counter
- [ ] Message search/filter

---

## ⚠️ Common Issues & Solutions

### Issue: Message tidak muncul di frontend

**Possible Causes:**
1. Frontend tidak listen ke Socket.IO event `new_message`
2. Message di-reject karena missing `id`
3. Socket.IO connection disconnected

**Debug Steps:**
```javascript
// 1. Verify Socket.IO connected
socket.on('connect', () => console.log('✅ Socket connected'));

// 2. Log all new_message events
socket.on('new_message', (msg) => {
  console.log('📩 Received:', msg);
  if (!msg.id) console.error('❌ Missing ID!');
});

// 3. Check network tab (WebSocket frames)
```

### Issue: Media tidak bisa di-load

**Possible Causes:**
1. `gcs_url` null atau invalid
2. CORS issue (GCS bucket tidak public)
3. Expired signed URL (jika pakai signed URL)

**Solution:**
- Verify `gcs_url` ada di payload
- Check GCS bucket permissions (must be public-read atau pakai signed URL)
- Open `gcs_url` di browser langsung untuk test

### Issue: Duplicate messages muncul

**Cause:** Socket.IO emit event multiple times atau reconnection

**Solution:**
- Check message `id` sebelum add to list
- Prevent duplicates:
  ```javascript
  if (messages.find(m => m.id === newMessage.id)) {
    return; // Already exists
  }
  ```

---

## 📚 Related Documentation

- **WHATSAPP_MESSAGE_TYPES.md** - Detail semua 15 tipe message dari WhatsApp
- **SOCKET_IO_EVENT_CONTRACT.md** - Complete Socket.IO payload specification

---

## 🚀 Summary

**Backend guarantees:**
✅ Semua message emit via Socket.IO event `new_message`  
✅ Semua field always present (null if no value)  
✅ Consistent structure untuk 15 tipe message  
✅ `gcs_url` public & accessible untuk media  
✅ Metadata terstruktur untuk special types  

**Frontend harus:**
✅ Validate `id`, `room_id`, `content_type` exists  
✅ Handle null values gracefully  
✅ Check `content_type` untuk render logic  
✅ Check `media_type` untuk media sub-types  
✅ Parse `metadata` untuk location, contacts, interactive  
✅ Prevent duplicate messages by `id`  

**Hubungi backend team jika:**
- Ada field yang selalu `null` (seharusnya ada value)
- Media `gcs_url` tidak accessible
- Message type baru muncul yang belum terdokumentasi
- Socket.IO events tidak received
