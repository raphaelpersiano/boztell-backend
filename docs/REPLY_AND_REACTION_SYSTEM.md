# Reply and Reaction System - Frontend Implementation Guide

## 📋 Overview

Backend Boztell sudah **fully support** sistem Reply dan Reaction untuk chat window. Dokumentasi ini menjelaskan bagaimana frontend harus mengimplementasikan kedua fitur ini.

---

## 🔄 Reply System

### Konsep
- Setiap message bisa menjadi **reply** ke message lain
- Reply diidentifikasi melalui field `reply_to_wa_message_id` di table `messages`
- Field ini berisi `wa_message_id` dari message yang di-reply

### Database Schema
```sql
-- Table: messages
reply_to_wa_message_id TEXT  -- WhatsApp message ID yang di-reply (nullable)
wa_message_id TEXT            -- WhatsApp message ID dari message ini sendiri (unique identifier)
```

### Cara Kerja

#### 1. **Mengirim Reply Message (Outgoing)**

Frontend mengirim message dengan parameter `replyTo`:

```javascript
// POST /messages/send (text message)
{
  "to": "6287879565390",
  "text": "Terima kasih atas infonya!",
  "room_id": "room-uuid-here",
  "user_id": "agent-001",
  "replyTo": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjRDQTY1RTU3ODcxRjE5MzQ4MAA="  // wa_message_id yang di-reply
}

// POST /messages/send-media (media message)
{
  "to": "6287879565390",
  "mediaType": "image",
  "mediaId": "media-id-here",
  "room_id": "room-uuid-here",
  "user_id": "agent-001",
  "caption": "Ini gambarnya",
  "replyTo": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjRDQTY1RTU3ODcxRjE5MzQ4MAA="
}

// POST /messages/send-media-combined (upload + send)
FormData {
  media: [File],
  to: "6287879565390",
  room_id: "room-uuid-here",
  user_id: "agent-001",
  caption: "Ini foto produknya",
  replyTo: "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjRDQTY1RTU3ODcxRjE5MzQ4MAA="
}
```

**Backend akan:**
1. Mengirim message ke WhatsApp API dengan context reply
2. Menyimpan `reply_to_wa_message_id` di database
3. Emit via Socket.IO dengan field `reply_to_wa_message_id`

#### 2. **Menerima Reply Message (Incoming via Webhook)**

Backend otomatis mendeteksi reply dari customer:

```javascript
// Socket.IO event: 'room:new_message'
{
  "id": "uuid-message",
  "room_id": "room-uuid",
  "user_id": null,  // null = customer message
  "content_type": "text",
  "content_text": "Oke sip, saya tunggu ya",
  "wa_message_id": "wamid.NEW123456",
  "reply_to_wa_message_id": "wamid.OLD123456",  // ⬅️ Message yang di-reply
  "created_at": "2025-01-27T10:30:00.000Z",
  ...
}
```

### Frontend Implementation

#### **Display Reply Chain**

```javascript
// Fungsi untuk mencari message yang di-reply
function findRepliedMessage(messages, replyToWaMessageId) {
  return messages.find(msg => msg.wa_message_id === replyToWaMessageId);
}

// Render message dengan reply indicator
function renderMessage(message, allMessages) {
  const repliedMessage = message.reply_to_wa_message_id 
    ? findRepliedMessage(allMessages, message.reply_to_wa_message_id)
    : null;

  return (
    <div className="message">
      {repliedMessage && (
        <div className="reply-indicator">
          <div className="replied-to">
            <span className="author">{repliedMessage.user_id ? 'Agent' : 'Customer'}</span>
            <span className="text">{repliedMessage.content_text}</span>
          </div>
        </div>
      )}
      <div className="message-content">
        {message.content_text}
      </div>
    </div>
  );
}
```

#### **Send Reply**

```javascript
// User click "Reply" button pada message
function handleReplyClick(messageToReply) {
  setReplyingTo({
    wa_message_id: messageToReply.wa_message_id,
    content_text: messageToReply.content_text,
    author: messageToReply.user_id ? 'Agent' : 'Customer'
  });
}

// Send message dengan reply
async function sendReplyMessage(text, roomId, userId, replyTo) {
  const response = await fetch('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phoneNumber,
      text: text,
      room_id: roomId,
      user_id: userId,
      replyTo: replyTo  // wa_message_id yang di-reply
    })
  });
  
  return response.json();
}
```

---

## 😀 Reaction System

### Konsep
- Reaction adalah **message tersendiri** di table `messages` dengan `content_type: 'reaction'`
- Setiap reaction memiliki emoji (`reaction_emoji`) dan target message (`reaction_to_wa_message_id`)
- Satu message bisa punya **multiple reactions** (dari user berbeda)

### Database Schema
```sql
-- Table: messages
content_type TEXT              -- 'reaction' untuk reaction messages
reaction_emoji TEXT            -- Emoji yang digunakan (nullable, hanya untuk reaction)
reaction_to_wa_message_id TEXT -- wa_message_id dari message yang di-react (nullable)
wa_message_id TEXT             -- WhatsApp message ID dari reaction ini sendiri
```

### Cara Kerja

#### 1. **Mengirim Reaction (Outgoing)**

```javascript
// POST /messages/send-reaction
{
  "to": "6287879565390",
  "message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjRDQTY1RTU3ODcxRjE5MzQ4MAA=",  // wa_message_id yang di-react
  "emoji": "👍",
  "room_id": "room-uuid-here",
  "user_id": "agent-001"
}
```

**Response:**
```json
{
  "success": true,
  "to": "6287879565390",
  "type": "reaction",
  "message_id": "uuid-reaction-message",
  "whatsapp_message_id": "wamid.REACTION123"
}
```

**Backend akan:**
1. Mengirim reaction ke WhatsApp API
2. Membuat **record baru** di table `messages` dengan:
   - `content_type: 'reaction'`
   - `reaction_emoji: '👍'`
   - `reaction_to_wa_message_id: 'wamid.TARGET'`
3. Emit via Socket.IO

#### 2. **Menerima Reaction (Incoming via Webhook)**

```javascript
// Socket.IO event: 'room:new_message'
{
  "id": "uuid-reaction",
  "room_id": "room-uuid",
  "user_id": null,  // null = customer reaction
  "content_type": "reaction",  // ⬅️ Type adalah 'reaction'
  "content_text": "Reacted 👍 to message",
  "wa_message_id": "wamid.REACTION789",
  "reaction_emoji": "👍",  // ⬅️ Emoji
  "reaction_to_wa_message_id": "wamid.TARGET123",  // ⬅️ Message yang di-react
  "reply_to_wa_message_id": null,
  "created_at": "2025-01-27T10:30:00.000Z",
  ...
}
```

### Frontend Implementation

#### **Group Reactions by Message**

```javascript
// Fungsi untuk group reactions per message
function groupReactionsByMessage(messages) {
  const reactions = {};
  
  messages
    .filter(msg => msg.content_type === 'reaction')
    .forEach(reaction => {
      const targetId = reaction.reaction_to_wa_message_id;
      
      if (!reactions[targetId]) {
        reactions[targetId] = [];
      }
      
      reactions[targetId].push({
        emoji: reaction.reaction_emoji,
        user_id: reaction.user_id,
        wa_message_id: reaction.wa_message_id,
        created_at: reaction.created_at
      });
    });
  
  return reactions;
}

// Aggregate sama emoji
function aggregateReactions(reactions) {
  const aggregated = {};
  
  reactions.forEach(reaction => {
    if (!aggregated[reaction.emoji]) {
      aggregated[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: []
      };
    }
    
    aggregated[reaction.emoji].count++;
    aggregated[reaction.emoji].users.push({
      user_id: reaction.user_id,
      wa_message_id: reaction.wa_message_id
    });
  });
  
  return Object.values(aggregated);
}
```

#### **Display Reactions**

```javascript
function renderMessage(message, allMessages) {
  const reactionGroups = groupReactionsByMessage(allMessages);
  const messageReactions = reactionGroups[message.wa_message_id] || [];
  const aggregated = aggregateReactions(messageReactions);
  
  return (
    <div className="message">
      <div className="message-content">
        {message.content_text}
      </div>
      
      {aggregated.length > 0 && (
        <div className="reactions">
          {aggregated.map(reaction => (
            <div key={reaction.emoji} className="reaction-badge">
              <span className="emoji">{reaction.emoji}</span>
              <span className="count">{reaction.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### **Send Reaction**

```javascript
// User click reaction emoji pada message
async function sendReaction(messageToReact, emoji, roomId, userId) {
  const response = await fetch('/messages/send-reaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phoneNumber,
      message_id: messageToReact.wa_message_id,  // ⬅️ wa_message_id yang di-react
      emoji: emoji,
      room_id: roomId,
      user_id: userId
    })
  });
  
  return response.json();
}

// Remove reaction (send empty emoji)
async function removeReaction(messageToReact, roomId, userId) {
  return sendReaction(messageToReact, '', roomId, userId);
}
```

---

## 🔍 Filter Messages for Display

```javascript
// Filter hanya messages yang bukan reaction untuk display utama
function getDisplayMessages(messages) {
  return messages.filter(msg => msg.content_type !== 'reaction');
}

// Get all messages termasuk reactions untuk processing
function getAllMessages(messages) {
  return messages;  // Keep all messages including reactions
}

// Example usage
const allMessages = await fetchMessages(roomId);
const displayMessages = getDisplayMessages(allMessages);  // Untuk chat list
const reactions = groupReactionsByMessage(allMessages);   // Untuk reaction display
```

---

## 📊 Complete Message Structure

```typescript
interface Message {
  // Basic Info
  id: string;                          // UUID internal
  room_id: string;                     // Room UUID
  user_id: string | null;              // null = customer, string = agent/admin
  
  // Content
  content_type: 'text' | 'media' | 'location' | 'contacts' | 'template' | 'reaction';
  content_text: string | null;
  
  // WhatsApp IDs
  wa_message_id: string;               // ⭐ Unique identifier dari WhatsApp
  
  // Reply System
  reply_to_wa_message_id: string | null;  // ⭐ wa_message_id yang di-reply
  
  // Reaction System
  reaction_emoji: string | null;          // ⭐ Emoji (hanya untuk content_type='reaction')
  reaction_to_wa_message_id: string | null;  // ⭐ wa_message_id yang di-react
  
  // Media (if applicable)
  media_type: 'image' | 'video' | 'audio' | 'document' | null;
  media_id: string | null;
  gcs_url: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Status (for outgoing messages)
  status: 'sent' | 'delivered' | 'read' | string;
  status_timestamp: string;
}
```

---

## 🎯 Key Points untuk Frontend

### Reply System
1. **Identifikasi reply:** Check `reply_to_wa_message_id !== null`
2. **Cari original message:** Match dengan `wa_message_id` di list messages
3. **Display:** Tampilkan preview message yang di-reply di atas message current
4. **Send reply:** Include parameter `replyTo` saat kirim message

### Reaction System
1. **Identifikasi reaction:** Check `content_type === 'reaction'`
2. **Filter dari chat:** Jangan tampilkan reaction sebagai message biasa
3. **Group by target:** Group semua reactions berdasarkan `reaction_to_wa_message_id`
4. **Aggregate:** Count sama emoji untuk tampilan
5. **Send reaction:** Gunakan endpoint `/messages/send-reaction`

### Socket.IO Real-time
```javascript
// Listen untuk new messages (termasuk reply dan reaction)
socket.on('room:new_message', (message) => {
  if (message.content_type === 'reaction') {
    // Update reaction display
    updateReactionDisplay(message);
  } else {
    // Add to chat list
    addMessageToChat(message);
  }
});
```

---

## 🧪 Testing Scenarios

### Test Reply
```bash
# 1. Send normal message
POST /messages/send
{
  "to": "6287879565390",
  "text": "Halo, ada pertanyaan?",
  "room_id": "room-123",
  "user_id": "agent-001"
}
# Response: { whatsapp_message_id: "wamid.ABC123" }

# 2. Reply to that message
POST /messages/send
{
  "to": "6287879565390",
  "text": "Ini jawabannya",
  "room_id": "room-123",
  "user_id": "agent-001",
  "replyTo": "wamid.ABC123"  # ⬅️ Use wa_message_id from step 1
}

# 3. Check database
SELECT wa_message_id, reply_to_wa_message_id, content_text 
FROM messages 
WHERE room_id = 'room-123'
ORDER BY created_at;
```

### Test Reaction
```bash
# 1. React to a message
POST /messages/send-reaction
{
  "to": "6287879565390",
  "message_id": "wamid.ABC123",  # ⬅️ wa_message_id to react
  "emoji": "👍",
  "room_id": "room-123",
  "user_id": "agent-001"
}

# 2. Check database
SELECT content_type, reaction_emoji, reaction_to_wa_message_id 
FROM messages 
WHERE room_id = 'room-123' 
AND content_type = 'reaction';
```

---

## ⚠️ Important Notes

1. **wa_message_id is the Key:**
   - Selalu gunakan `wa_message_id` untuk reference, bukan `id` (UUID internal)
   - `wa_message_id` unik dan konsisten across WhatsApp API

2. **Reaction adalah Message:**
   - Reaction disimpan sebagai record terpisah di table `messages`
   - Filter `content_type !== 'reaction'` untuk chat list display

3. **Reply bisa di Message atau Media:**
   - Semua endpoints support parameter `replyTo`
   - Reply bisa ke text, image, video, audio, document, dll

4. **Webhook otomatis handle:**
   - Reply dari customer otomatis terdeteksi via `context.id`
   - Reaction dari customer otomatis tersimpan
   - Socket.IO real-time emit untuk update frontend

5. **User ID untuk distinguish:**
   - `user_id = null` → Message/reaction dari customer
   - `user_id = 'agent-xxx'` → Message/reaction dari agent/admin

---

## 📞 Support

Jika ada pertanyaan implementasi, hubungi backend team atau check:
- API Documentation: `/docs/API-DOCS.md`
- Message System: `/docs/MESSAGES_API_DOCUMENTATION.md`
- Webhook Flow: `/docs/WHATSAPP_WEBHOOK_COVERAGE.md`
