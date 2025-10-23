# Socket.IO Event Contract

## ⚠️ CRITICAL REQUIREMENT

**Backend MUST emit complete message object with ALL fields when emitting `new_message` event.**

**Empty payload `{}` or missing required fields will cause frontend validation to REJECT the message.**

---

## Event: `new_message`

### Event Name
```javascript
io.emit('new_message', messageObject);
```

### ✅ CORRECT Usage

```javascript
// Backend emits DIRECT message object (NOT wrapped)
io.emit('new_message', {
  // ✅ REQUIRED FIELDS - MUST be present
  id: "550e8400-e29b-41d4-a716-446655440000",
  room_id: "660e8400-e29b-41d4-a716-446655440001",
  content_type: "text",
  content_text: "Hello, I need help!",
  user_id: null,
  created_at: "2025-10-23T10:30:00Z",
  updated_at: "2025-10-23T10:30:00Z",
  
  // ✅ REQUIRED WhatsApp fields
  wa_message_id: "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  status: "received",
  
  // ✅ ALL other fields (even if null)
  media_type: null,
  media_id: null,
  gcs_filename: null,
  gcs_url: null,
  file_size: null,
  mime_type: null,
  original_filename: null,
  reply_to_wa_message_id: null,
  reaction_emoji: null,
  reaction_to_wa_message_id: null,
  status_timestamp: null,
  metadata: null
});
```

### ❌ WRONG Usage

```javascript
// ❌ DON'T wrap in extra object
io.emit('new_message', {
  room_id: "...",
  message: { id: "...", ... }  // WRONG!
});

// ❌ DON'T emit incomplete object
io.emit('new_message', {
  id: "...",
  content_type: "text"
  // Missing other required fields - WRONG!
});

// ❌ DON'T emit empty object
io.emit('new_message', {}); // WRONG!
```

---

## Complete Message Object Structure

### TypeScript Interface

```typescript
interface SocketIOMessagePayload {
  // ═══════════════════════════════════════════════════════
  // ✅ REQUIRED FIELDS - MUST ALWAYS BE PRESENT
  // ═══════════════════════════════════════════════════════
  
  /** Database primary key UUID - MUST be present from database RETURNING * */
  id: string;
  
  /** Room/Chat UUID - MUST be present */
  room_id: string;
  
  /** Message type - MUST be present */
  content_type: 
    | "text" 
    | "media"
    | "location" 
    | "contacts" 
    | "reaction"
    | "interactive"
    | "button"
    | "order"
    | "system"
    | "referral"
    | "unsupported";
  
  /** Text content or caption - CAN be null for pure media */
  content_text: string | null;
  
  /** User ID - null = customer, UUID = agent */
  user_id: string | null;
  
  /** ISO 8601 timestamp - MUST be present */
  created_at: string;
  
  /** ISO 8601 timestamp - MUST be present */
  updated_at: string;
  
  /** WhatsApp message ID - CAN be null for agent messages */
  wa_message_id: string | null;
  
  /** Message status - MUST be present */
  status: "sent" | "delivered" | "read" | "failed" | "received" | null;
  
  // ═══════════════════════════════════════════════════════
  // ✅ MEDIA FIELDS - Present when content_type = "media"
  // ═══════════════════════════════════════════════════════
  
  /** Media subtype - REQUIRED if content_type = "media" */
  media_type: "image" | "video" | "audio" | "document" | "sticker" | null;
  
  /** WhatsApp media ID */
  media_id: string | null;
  
  /** Filename in Google Cloud Storage */
  gcs_filename: string | null;
  
  /** Public URL from GCS - REQUIRED for media display */
  gcs_url: string | null;
  
  /** File size in bytes */
  file_size: number | null;
  
  /** MIME type (e.g., 'image/jpeg', 'video/mp4') */
  mime_type: string | null;
  
  /** Original filename from upload */
  original_filename: string | null;
  
  // ═══════════════════════════════════════════════════════
  // ✅ METADATA - Contains type-specific structured data
  // ═══════════════════════════════════════════════════════
  
  /** Structured metadata for special message types */
  metadata: {
    /** For location messages (content_type = "location") */
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
    
    /** For contacts messages (content_type = "contacts") */
    contacts?: Array<{
      name: { formatted_name: string; first_name?: string; last_name?: string };
      phones?: Array<{ phone: string; type?: string; wa_id?: string }>;
      emails?: Array<{ email: string; type?: string }>;
      urls?: Array<{ url: string; type?: string }>;
      addresses?: Array<{ 
        street?: string; 
        city?: string; 
        state?: string; 
        zip?: string; 
        country?: string;
      }>;
      org?: { company?: string; department?: string; title?: string };
      birthday?: string;
    }>;
    
    /** For interactive messages (content_type = "interactive") */
    interactive?: {
      button_reply?: { 
        id: string; 
        title: string;
      };
      list_reply?: { 
        id: string; 
        title: string; 
        description?: string;
      };
    };
    
    /** For button messages (content_type = "button") */
    button?: {
      text: string;
      payload: string;
    };
    
    /** For order messages (content_type = "order") */
    order?: {
      catalog_id: string;
      product_items: Array<{
        product_retailer_id: string;
        quantity: number;
        item_price: number;
        currency: string;
      }>;
    };
    
    /** For referral messages (content_type = "referral") */
    referral?: {
      source_url: string;
      source_type: string;
      source_id: string;
      headline?: string;
      body?: string;
    };
    
    /** Any other custom fields */
    [key: string]: any;
  } | null;
  
  // ═══════════════════════════════════════════════════════
  // ✅ REPLY/REACTION FEATURES
  // ═══════════════════════════════════════════════════════
  
  /** WhatsApp message ID being replied to */
  reply_to_wa_message_id: string | null;
  
  /** Emoji character for reaction (e.g., '👍', '❤️') */
  reaction_emoji: string | null;
  
  /** WhatsApp message ID being reacted to */
  reaction_to_wa_message_id: string | null;
  
  /** Timestamp of last status update */
  status_timestamp: string | null;
  
  // ═══════════════════════════════════════════════════════
  // ✅ EXTENDED FIELDS (Optional - from database JOINs)
  // ═══════════════════════════════════════════════════════
  
  /** User/Agent information (if joined) */
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
  } | null;
  
  /** Replied message details (if joined) */
  replied_message?: {
    id: string;
    content_type: string;
    content_text: string | null;
    user_id: string | null;
    created_at: string;
    media_type?: string | null;
    gcs_url?: string | null;
  } | null;
}
```

---

## Backend Implementation Requirements

### 1. Database INSERT with RETURNING *

```javascript
// ✅ CORRECT - Get ALL fields from database
const { data: message, error } = await supabase
  .from('messages')
  .insert({
    room_id: roomId,
    user_id: userId,
    content_type: 'text',
    content_text: text,
    wa_message_id: waMessageId,
    status: 'sent',
    // ... other fields
  })
  .select('*')  // ← CRITICAL: Must select all fields
  .single();

if (error || !message) {
  throw new Error('Failed to insert message');
}

// Validate message has ID before emitting
if (!message.id) {
  throw new Error('Database did not return message ID');
}
```

### 2. Emit Complete Payload

```javascript
// ✅ CORRECT - Emit ALL fields explicitly
const messagePayload = {
  // Core fields
  id: message.id,
  room_id: message.room_id,
  user_id: message.user_id,
  content_type: message.content_type,
  content_text: message.content_text,
  wa_message_id: message.wa_message_id,
  status: message.status,
  created_at: message.created_at,
  updated_at: message.updated_at,
  
  // Media fields (even if null)
  media_type: message.media_type || null,
  media_id: message.media_id || null,
  gcs_filename: message.gcs_filename || null,
  gcs_url: message.gcs_url || null,
  file_size: message.file_size || null,
  mime_type: message.mime_type || null,
  original_filename: message.original_filename || null,
  
  // Reply/Reaction fields (even if null)
  reply_to_wa_message_id: message.reply_to_wa_message_id || null,
  reaction_emoji: message.reaction_emoji || null,
  reaction_to_wa_message_id: message.reaction_to_wa_message_id || null,
  status_timestamp: message.status_timestamp || null,
  
  // Metadata (even if null)
  metadata: message.metadata || null,
};

// Validate before emitting
if (!messagePayload.id || !messagePayload.room_id || !messagePayload.content_type) {
  console.error('❌ INVALID MESSAGE PAYLOAD:', messagePayload);
  throw new Error('Message payload missing required fields');
}

// Emit to Socket.IO
console.log('📡 Emitting new_message event:', messagePayload);
io.emit('new_message', messagePayload);
io.to(message.room_id).emit('room:new_message', messagePayload);
```

### 3. Validation Checklist

Before emitting `new_message`, backend MUST verify:

- ✅ `message.id` exists (UUID from database)
- ✅ `message.room_id` exists (UUID)
- ✅ `message.content_type` is valid enum value
- ✅ `message.created_at` is ISO 8601 string
- ✅ `message.updated_at` is ISO 8601 string
- ✅ All fields are present (even if `null`)
- ✅ No extra wrapping object `{ room_id, message: {...} }`

---

## Frontend Validation

### Required Field Checks

```typescript
const handleNewMessage = (message: SocketIOMessagePayload) => {
  console.log('📩 Received new_message event:', message);
  
  // ✅ CRITICAL: Validate required fields
  if (!message.id) {
    console.error('❌ REJECTED: Missing message.id', message);
    return;
  }
  
  if (!message.room_id) {
    console.error('❌ REJECTED: Missing message.room_id', message);
    return;
  }
  
  if (!message.content_type) {
    console.error('❌ REJECTED: Missing message.content_type', message);
    return;
  }
  
  if (!message.created_at) {
    console.error('❌ REJECTED: Missing message.created_at', message);
    return;
  }
  
  // ✅ Valid message - proceed
  addMessageToChat(message);
};
```

---

## Examples per Message Type

### Text Message

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "room_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": null,
  "content_type": "text",
  "content_text": "Hello, how can I help you?",
  "wa_message_id": "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  "status": "received",
  "created_at": "2025-10-23T10:30:00.000Z",
  "updated_at": "2025-10-23T10:30:00.000Z",
  "media_type": null,
  "media_id": null,
  "gcs_filename": null,
  "gcs_url": null,
  "file_size": null,
  "mime_type": null,
  "original_filename": null,
  "reply_to_wa_message_id": null,
  "reaction_emoji": null,
  "reaction_to_wa_message_id": null,
  "status_timestamp": null,
  "metadata": null
}
```

### Image Message

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "room_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": null,
  "content_type": "media",
  "content_text": "Check out this photo!",
  "wa_message_id": "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  "status": "received",
  "created_at": "2025-10-23T10:31:00.000Z",
  "updated_at": "2025-10-23T10:31:00.000Z",
  "media_type": "image",
  "media_id": "1234567890",
  "gcs_filename": "images/2025/10/abc123.jpg",
  "gcs_url": "https://storage.googleapis.com/bucket/images/2025/10/abc123.jpg",
  "file_size": 245678,
  "mime_type": "image/jpeg",
  "original_filename": "photo.jpg",
  "reply_to_wa_message_id": null,
  "reaction_emoji": null,
  "reaction_to_wa_message_id": null,
  "status_timestamp": null,
  "metadata": null
}
```

### Location Message

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "room_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": null,
  "content_type": "location",
  "content_text": "Monas: -6.1753924, 106.8271528",
  "wa_message_id": "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  "status": "received",
  "created_at": "2025-10-23T10:32:00.000Z",
  "updated_at": "2025-10-23T10:32:00.000Z",
  "media_type": null,
  "media_id": null,
  "gcs_filename": null,
  "gcs_url": null,
  "file_size": null,
  "mime_type": null,
  "original_filename": null,
  "reply_to_wa_message_id": null,
  "reaction_emoji": null,
  "reaction_to_wa_message_id": null,
  "status_timestamp": null,
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

### Contacts Message

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "room_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": null,
  "content_type": "contacts",
  "content_text": "Shared contacts: John Doe",
  "wa_message_id": "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  "status": "received",
  "created_at": "2025-10-23T10:33:00.000Z",
  "updated_at": "2025-10-23T10:33:00.000Z",
  "media_type": null,
  "media_id": null,
  "gcs_filename": null,
  "gcs_url": null,
  "file_size": null,
  "mime_type": null,
  "original_filename": null,
  "reply_to_wa_message_id": null,
  "reaction_emoji": null,
  "reaction_to_wa_message_id": null,
  "status_timestamp": null,
  "metadata": {
    "contacts": [
      {
        "name": { "formatted_name": "John Doe" },
        "phones": [{ "phone": "+6281234567890" }],
        "emails": [{ "email": "john@example.com" }]
      }
    ]
  }
}
```

### Reaction Message

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "room_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": null,
  "content_type": "reaction",
  "content_text": "Reacted ❤️ to message",
  "wa_message_id": "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  "status": "received",
  "created_at": "2025-10-23T10:34:00.000Z",
  "updated_at": "2025-10-23T10:34:00.000Z",
  "media_type": null,
  "media_id": null,
  "gcs_filename": null,
  "gcs_url": null,
  "file_size": null,
  "mime_type": null,
  "original_filename": null,
  "reply_to_wa_message_id": null,
  "reaction_emoji": "❤️",
  "reaction_to_wa_message_id": "wamid.ORIGINAL_MESSAGE_ID",
  "status_timestamp": null,
  "metadata": null
}
```

### Interactive Button Reply

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "room_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": null,
  "content_type": "interactive",
  "content_text": "Button clicked: Yes, I'm interested",
  "wa_message_id": "wamid.HBgNNjI4MTIzNDU2Nzg5MBUAG...",
  "status": "received",
  "created_at": "2025-10-23T10:35:00.000Z",
  "updated_at": "2025-10-23T10:35:00.000Z",
  "media_type": null,
  "media_id": null,
  "gcs_filename": null,
  "gcs_url": null,
  "file_size": null,
  "mime_type": null,
  "original_filename": null,
  "reply_to_wa_message_id": null,
  "reaction_emoji": null,
  "reaction_to_wa_message_id": null,
  "status_timestamp": null,
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

---

## Testing Checklist

### Backend Testing

- [ ] Log complete `messagePayload` before emitting
- [ ] Verify `message.id` exists from database
- [ ] Verify all required fields present
- [ ] Test text message emission
- [ ] Test image message emission
- [ ] Test video message emission
- [ ] Test audio message emission
- [ ] Test document message emission
- [ ] Test location message emission
- [ ] Test contacts message emission
- [ ] Test reaction message emission
- [ ] Test interactive message emission
- [ ] Verify no extra wrapping object

### Frontend Testing

- [ ] Listen to `new_message` event
- [ ] Log received message object
- [ ] Verify `message.id` validation works
- [ ] Verify `message.room_id` validation works
- [ ] Verify `message.content_type` validation works
- [ ] Test duplicate message prevention
- [ ] Test message rendering for all types
- [ ] Test null field handling

---

## Common Errors & Solutions

### Error: "Received message without id"

**Cause:** Database INSERT did not use `.select('*')` or `.single()`

**Solution:**
```javascript
// ❌ WRONG
const { error } = await supabase.from('messages').insert(data);

// ✅ CORRECT
const { data: message, error } = await supabase
  .from('messages')
  .insert(data)
  .select('*')
  .single();
```

### Error: "Cannot read properties of undefined (reading 'startsWith')"

**Cause:** Missing field in payload (e.g., `content_text` is undefined instead of null)

**Solution:**
```javascript
// Ensure all fields have explicit values (even if null)
content_text: message.content_text || null,  // Not undefined
```

### Error: Frontend doesn't receive message

**Cause:** Message wrapped in extra object or missing required fields

**Solution:**
```javascript
// ❌ WRONG
io.emit('new_message', { room_id, message });

// ✅ CORRECT
io.emit('new_message', messagePayload);
```

---

## Summary

✅ **Backend MUST emit direct message object** (not wrapped)  
✅ **ALL fields MUST be present** (use `null` for empty values, not `undefined`)  
✅ **Required fields:** `id`, `room_id`, `content_type`, `created_at`, `updated_at`  
✅ **Validate before emitting:** Check `id`, `room_id`, `content_type` exist  
✅ **Use database `.select('*').single()`** to get complete message object  
✅ **Frontend MUST validate:** Reject messages without `id`, `room_id`, `content_type`

**This contract ensures reliable real-time messaging across ALL 15 WhatsApp message types.** 🚀
