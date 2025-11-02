# 🚀 Quick Reference Card - Socket.IO Events

## For Backend Developers

### Event yang Di-emit:

```javascript
// 1️⃣ new_room_complete (customer baru pertama kali chat)
io.emit('new_room_complete', {
  room_id, room_phone, room_title,
  leads_info: { full object },
  last_message: { first message },
  unread_count: 1,
  participants: []
});

// 2️⃣ new_message (semua messages)
io.emit('new_message', {
  id, room_id, user_id, content_text, content_type,
  wa_message_id, created_at, ...
});

// 3️⃣ room:new_message (room-specific)
io.to(`room:${room_id}`).emit('room:new_message', messagePayload);
```

### Check Implementation:
```bash
# Check if event emitted
tail -f logs/app.log | grep "new_room_complete"

# Test with customer baru
# Expected log: "📡 Emitting new_room_complete event - new room with full data"
```

---

## For Frontend Developers

### Quick Implementation:

```typescript
// 1️⃣ Setup Socket Connection
const socket = io('http://localhost:8080', {
  transports: ['websocket']
});

// 2️⃣ Listen for New Room (customer baru)
socket.on('new_room_complete', (room) => {
  console.log('🆕 New room:', room.leads_info?.name);
  setRooms(prev => [room, ...prev]);
});

// 3️⃣ Listen for New Message (existing room)
socket.on('new_message', (message) => {
  console.log('💬 New message:', message.content_text);
  // Update rooms list with last_message
  // Update messages if room is open
});

// 4️⃣ Join Room (saat buka chat window)
socket.emit('room:join', { room_id: roomId });
socket.on('room:new_message', (msg) => {
  setMessages(prev => [...prev, msg]);
});
```

### Display Customer Name:
```typescript
// ✅ Correct way
const name = room.leads_info?.name || room.room_title || room.room_phone;

// ❌ Old way (will show "Unknown")
const name = room.room_title || "Unknown";
```

### Test Checklist:
```typescript
// Test 1: Customer baru chat
// ✅ Room muncul dengan customer name
// ✅ Last message tampil
// ✅ Unread badge = 1

// Test 2: Customer existing chat
// ✅ Last message update
// ✅ Unread count +1

// Test 3: Open room
// ✅ Messages load
// ✅ New messages append real-time
```

---

## Common Issues & Solutions

### Issue: "Unknown" Customer Name
**Cause:** Using `room.room_title` instead of `room.leads_info.name`

**Solution:**
```typescript
const customerName = room.leads_info?.name || room.room_title || room.room_phone;
```

### Issue: Empty Room Window
**Cause:** Not listening to `new_room_complete` event

**Solution:**
```typescript
socket.on('new_room_complete', (room) => {
  // Room already has last_message
  setRooms(prev => [room, ...prev]);
});
```

### Issue: Need Refresh to See Data
**Cause:** Race condition with old `new_room` event

**Solution:** Update to `new_room_complete` event

---

## Event Comparison

| Event | When | Data |
|-------|------|------|
| `new_room_complete` | Customer baru | Full room + first message + leads |
| `new_message` | Any message | Message only |
| `room:new_message` | Room-specific | Message only (to joined users) |

---

## TypeScript Interfaces

```typescript
interface NewRoomCompleteEvent {
  room_id: string;
  room_phone: string;
  room_title: string;
  room_created_at: string;
  room_updated_at: string;
  leads_id: string | null;
  leads_info: {
    id: string;
    utm_id: string | null;
    name: string;
    phone: string;
    outstanding: number;
    loan_type: string;
    leads_status: string;
    contact_status: string;
  } | null;
  last_message: {
    id: string;
    content_text: string;
    content_type: string;
    created_at: string;
    user_id: string | null;
    wa_message_id: string;
  };
  last_message_text: string;
  last_message_timestamp: string;
  last_message_type: string;
  unread_count: number;
  message_count: number;
  participants: Participant[];
}

interface NewMessageEvent {
  id: string;
  room_id: string;
  user_id: string | null;
  content_type: string;
  content_text: string | null;
  wa_message_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // ... media fields ...
}
```

---

## Quick Test Commands

```bash
# Backend
npm start
tail -f logs/app.log | grep "Socket"

# Frontend (browser console)
socket.on('new_room_complete', console.log);
socket.on('new_message', console.log);

# Test with curl (simulate webhook)
curl -X POST http://localhost:8080/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{ ... webhook payload ... }'
```

---

## Documentation Links

- **API Docs:** `MESSAGES_API_DOCUMENTATION.md`
- **Socket Events:** `SOCKET_EVENTS_DOCUMENTATION.md`
- **Frontend Guide:** `FRONTEND_SOCKET_INTEGRATION.md`
- **Verification:** `BACKEND_CHECKLIST_VERIFIED.md`
- **Deployment:** `DEPLOYMENT_SUMMARY.md`

---

**Status:** ✅ Ready for Integration  
**Last Updated:** November 2, 2025
