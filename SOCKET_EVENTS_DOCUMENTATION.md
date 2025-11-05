# Socket.IO Events Documentation

## Overview
Backend menggunakan Socket.IO untuk real-time updates. Semua events di-broadcast ke semua connected clients untuk mensinkronisasi data.

---

## 🔍 ANALISIS MASALAH CURRENT

### ❌ Masalah Yang Terjadi:
1. **Customer baru chat** → Socket event datang
2. **Sidebar update** → Room muncul di list  
3. **Data tidak lengkap** → `customerName = "Unknown"`, room window kosong
4. **Setelah refresh** → Data lengkap, semua normal

### 🎯 Root Cause:
Backend emit 2 events berbeda dengan data yang berbeda:

#### 1. Event `new_room` (dari `roomService.js`)
```javascript
// Di roomService.js line 104-114
const newRoomPayload = {
  room_id: newRoom.id,
  room_phone: newRoom.phone,
  room_title: newRoom.title,
  room_created_at: newRoom.created_at,
  room_updated_at: newRoom.updated_at,
  leads_info: leadsId ? {
    id: leadsId,
    phone: phone,
    name: metadata.customer_name || `Customer ${phone}`
  } : null,
  unread_count: 0,
  last_message: null,
  participants: []
};

io.emit('new_room', newRoomPayload);
```

**Data yang dikirim:**
- ✅ `room_phone` 
- ✅ `room_title`
- ✅ `leads_info` (tapi minimal data)
- ❌ **TIDAK ADA** `last_message_text`
- ❌ **TIDAK ADA** `last_message_timestamp`

#### 2. Event `new_message` (dari `messageService.js`)
```javascript
// Di messageService.js line 95-99
const messagePayload = {
  id: message.id,
  room_id: message.room_id,
  user_id: message.user_id || null,
  content_type: message.content_type,
  content_text: message.content_text || null,
  wa_message_id: message.wa_message_id || null,
  // ... dll (full message data)
};

io.to(`room:${input.room_id}`).emit('room:new_message', messagePayload);
io.emit('new_message', messagePayload);
```

**Data yang dikirim:**
- ✅ Message lengkap
- ❌ **TIDAK ADA** room data (phone, title, leads_info)

---

## 📡 SOCKET EVENTS YANG DI-EMIT BACKEND

### 1. `new_room` Event

**Kapan di-emit:**
- Saat customer baru pertama kali chat (room belum ada)
- Di-emit dari `roomService.js` → `ensureRoom()` function

**Payload Structure:**
```javascript
{
  room_id: "uuid-room-id",
  room_phone: "6287879565390",
  room_title: "Personal", // atau customer name jika ada
  room_created_at: "2025-11-02T10:30:00.000Z",
  room_updated_at: "2025-11-02T10:30:00.000Z",
  leads_info: {
    id: "uuid-lead-id",
    phone: "6287879565390",
    name: "Customer 6287879565390" // atau nama sebenarnya
  } || null,
  unread_count: 0,
  last_message: null,
  participants: []
}
```

**Frontend Should:**
```javascript
socket.on('new_room', (data) => {
  console.log('[Socket] new_room:', data);
  
  // Add room to rooms list
  setRooms(prev => [data, ...prev]);
  
  // ⚠️ MASALAH: last_message null, jadi room terlihat kosong
});
```

---

### 2. `new_message` Event

**Kapan di-emit:**
- Setiap ada message baru (incoming dari customer atau outgoing dari agent)
- Di-emit dari `messageService.js` → `handleIncomingMessage()` function

**Payload Structure:**
```javascript
{
  id: "uuid-message-id",
  room_id: "uuid-room-id",
  user_id: null, // null = customer, uuid = agent
  content_type: "text", // text, image, video, audio, document, etc.
  content_text: "Hello from customer",
  wa_message_id: "wamid.xxx",
  status: "sent",
  reply_to_wa_message_id: null,
  reaction_emoji: null,
  reaction_to_wa_message_id: null,
  status_timestamp: null,
  // Media fields
  media_type: null,
  media_id: null,
  gcs_filename: null,
  gcs_url: null,
  file_size: null,
  mime_type: null,
  original_filename: null,
  // Metadata
  metadata: {},
  created_at: "2025-11-02T10:30:05.000Z",
  updated_at: "2025-11-02T10:30:05.000Z"
}
```

**Frontend Should:**
```javascript
socket.on('new_message', (message) => {
  console.log('[Socket] new_message:', message);
  
  // 1. Update messages list (jika room sedang dibuka)
  if (currentRoomId === message.room_id) {
    setMessages(prev => [...prev, message]);
  }
  
  // 2. Update rooms list (last_message dan unread_count)
  setRooms(prev => prev.map(room => {
    if (room.room_id === message.room_id) {
      return {
        ...room,
        last_message_text: message.content_text,
        last_message_timestamp: message.created_at,
        unread_count: room.room_id === currentRoomId ? 0 : room.unread_count + 1
      };
    }
    return room;
  }));
  
  // ⚠️ MASALAH: Jika room baru (dari new_room event), 
  // room data tidak ada customer name, leads_info minimal
});
```

---

### 3. `room:new_message` Event

**Kapan di-emit:**
- Same as `new_message`, tapi hanya ke clients yang sudah join room tersebut
- Di-emit ke `io.to(\`room:${room_id}\`)`

**Payload Structure:**
- Sama persis dengan `new_message` event

**Frontend Should:**
```javascript
// Join room saat buka chat room
socket.emit('room:join', { room_id: currentRoomId });

// Listen untuk messages di room ini
socket.on('room:new_message', (message) => {
  console.log('[Socket] room:new_message:', message);
  setMessages(prev => [...prev, message]);
});

// Leave room saat tutup/pindah room
socket.on('room:leave', { room_id: previousRoomId });
```

---

## 🔧 SOLUSI UNTUK MASALAH RACE CONDITION

### Masalah:
```
1. new_room event → Room data minimal (no last_message)
2. new_message event → Message data lengkap (no room details)
3. Frontend gabungkan → Race condition, data tidak sync
```

### ✅ Solusi 1: Update `new_room` Event Payload (Backend Fix)

**File:** `src/services/roomService.js`

**Update `ensureRoom()` function:**
```javascript
// Setelah create room, tunggu first message dari webhook
// Lalu emit new_room dengan last_message included

// ATAU

// Emit new_room event SETELAH message pertama disave
// Jadi new_room sudah include last_message
```

### ✅ Solusi 2: Emit Combined Event (Backend Fix - RECOMMENDED)

**File:** `src/services/messageService.js`

**Tambahkan logic untuk check if new room:**
```javascript
export async function handleIncomingMessage({ io }, input) {
  // ... existing code ...
  
  // Check if this is first message in room (room just created)
  const { getRoomMessageCount } = await import('../db.js');
  const messageCount = await getRoomMessageCount(input.room_id);
  
  if (messageCount === 1) {
    // This is first message, emit complete room data
    const { getRoomWithDetails } = await import('../db.js');
    const roomDetails = await getRoomWithDetails(input.room_id);
    
    const newRoomWithMessage = {
      room_id: roomDetails.room_id,
      room_phone: roomDetails.phone,
      room_title: roomDetails.title,
      room_created_at: roomDetails.created_at,
      room_updated_at: roomDetails.updated_at,
      leads_info: roomDetails.leads_info,
      unread_count: 1,
      last_message_text: messagePayload.content_text,
      last_message_timestamp: messagePayload.created_at,
      last_message_type: messagePayload.content_type,
      participants: roomDetails.participants || []
    };
    
    io.emit('new_room_with_message', newRoomWithMessage);
  }
  
  // ... rest of code ...
}
```

### ✅ Solusi 3: Frontend Fetch After Socket Event (Frontend Fix - QUICK FIX)

**File:** Frontend `useSocket.js` atau socket handler

```javascript
socket.on('new_room', async (roomData) => {
  console.log('[Socket] new_room:', roomData);
  
  // ⚠️ Room data tidak lengkap, fetch detail dari API
  try {
    const response = await fetch(`/rooms/${roomData.room_id}`);
    const fullRoomData = await response.json();
    
    // Update rooms dengan data lengkap
    setRooms(prev => [fullRoomData.data, ...prev]);
  } catch (error) {
    console.error('Failed to fetch room details:', error);
    // Fallback: gunakan data dari socket (meskipun tidak lengkap)
    setRooms(prev => [roomData, ...prev]);
  }
});

socket.on('new_message', (message) => {
  console.log('[Socket] new_message:', message);
  
  // Update rooms list dengan last_message
  setRooms(prev => prev.map(room => {
    if (room.room_id === message.room_id) {
      return {
        ...room,
        last_message_text: message.content_text,
        last_message_timestamp: message.created_at,
        last_message_type: message.content_type,
        unread_count: room.room_id === currentRoomId ? 0 : (room.unread_count || 0) + 1
      };
    }
    return room;
  }));
  
  // Juga update messages jika room sedang dibuka
  if (currentRoomId === message.room_id) {
    setMessages(prev => [...prev, message]);
  }
});
```

---

## 🎯 REKOMENDASI

### Backend Changes (BEST SOLUTION):

1. **Hapus `new_room` event dari `roomService.js`**
   - Room creation jangan emit event dulu
   - Tunggu sampai message pertama masuk

2. **Update `new_message` event di `messageService.js`**
   - Detect jika ini message pertama di room
   - Emit `new_room_complete` event dengan full room + message data

3. **Struktur event baru:**
```javascript
// Event: new_room_complete
{
  // Room data
  room_id: "uuid",
  room_phone: "6287879565390",
  room_title: "Customer Name",
  room_created_at: "...",
  room_updated_at: "...",
  
  // Leads info (full)
  leads_info: {
    id: "uuid",
    name: "John Doe",
    phone: "6287879565390",
    outstanding: 50000000,
    loan_type: "personal_loan",
    leads_status: "cold",
    contact_status: "contacted"
  },
  
  // First message
  last_message: {
    id: "uuid",
    content_text: "Hello from customer",
    content_type: "text",
    created_at: "...",
    user_id: null // customer message
  },
  
  // Counts
  unread_count: 1,
  message_count: 1,
  
  // Participants
  participants: []
}
```

### Frontend Changes:

```javascript
// Listen untuk room baru dengan data lengkap
socket.on('new_room_complete', (room) => {
  console.log('[Socket] new_room_complete:', room);
  setRooms(prev => [room, ...prev]);
});

// Listen untuk message baru di room yang sudah ada
socket.on('new_message', (message) => {
  console.log('[Socket] new_message:', message);
  
  // Update rooms list
  setRooms(prev => prev.map(r => 
    r.room_id === message.room_id ? {
      ...r,
      last_message: {
        content_text: message.content_text,
        content_type: message.content_type,
        created_at: message.created_at
      },
      unread_count: r.room_id === currentRoomId ? 0 : (r.unread_count || 0) + 1
    } : r
  ));
  
  // Update messages jika room sedang dibuka
  if (currentRoomId === message.room_id) {
    setMessages(prev => [...prev, message]);
  }
});
```

---

## 📝 TESTING GUIDE

### Test Scenario 1: Customer Baru Chat

**Steps:**
1. Customer yang belum pernah chat kirim message
2. Backend create room baru
3. Backend save message
4. Backend emit events

**Expected Backend Logs:**
```
[roomService] New room created: room_id=xxx, phone=xxx
[messageService] Message saved: message_id=xxx, room_id=xxx
[messageService] Emitting events: new_room_complete, new_message
```

**Expected Frontend Behavior:**
1. Socket event diterima: `new_room_complete`
2. Room muncul di sidebar dengan:
   - ✅ Customer name (dari leads_info)
   - ✅ Last message text
   - ✅ Timestamp
   - ✅ Unread count = 1
3. Klik room → Messages langsung muncul

### Test Scenario 2: Customer Existing Chat Lagi

**Steps:**
1. Customer yang sudah ada room-nya chat lagi
2. Backend tidak create room baru
3. Backend save message
4. Backend emit `new_message` only

**Expected Frontend Behavior:**
1. Socket event: `new_message`
2. Room di sidebar update:
   - ✅ Last message berubah
   - ✅ Timestamp update
   - ✅ Unread count +1
3. Jika room sedang dibuka → Message langsung append

---

## 🚨 TROUBLESHOOTING

### Issue: "Unknown Customer" di sidebar

**Cause:** `leads_info.name` null atau undefined

**Solution:**
```javascript
// Backend: Always set default name
const leadData = {
  name: metadata.customer_name || `Customer ${phone}`,
  // ...
};

// Frontend: Fallback untuk display
const displayName = room.leads_info?.name || room.room_title || room.room_phone;
```

### Issue: Room window kosong setelah klik

**Cause:** Messages belum di-fetch atau `last_message` null

**Solution:**
```javascript
// Frontend: Fetch messages saat buka room
useEffect(() => {
  const fetchMessages = async () => {
    const response = await fetch(`/messages?room_id=${roomId}`);
    const data = await response.json();
    setMessages(data.messages);
  };
  fetchMessages();
}, [roomId]);
```

### Issue: Data sync setelah refresh

**Cause:** REST API return full data, socket events return partial data

**Solution:** Backend emit full data di socket events (seperti rekomendasi di atas)

---

## 📞 NEXT STEPS

1. **Check frontend console:**
   - Log semua socket events yang diterima
   - Check payload structure
   - Bandingkan dengan dokumentasi ini

2. **Konfirmasi events:**
   - Apakah terima `new_room` event?
   - Apakah terima `new_message` event?
   - Data apa yang ada di payload?

3. **Pilih solusi:**
   - **Quick fix:** Frontend fetch setelah socket event (Solusi 3)
   - **Best fix:** Backend emit combined event (Solusi 2)

4. **Implement & test:**
   - Implement solusi yang dipilih
   - Test dengan customer baru
   - Verify data lengkap tanpa refresh

---

Mau saya implement solusi yang mana? 

- ✅ **Solusi 1:** Update backend emit full room data di `new_room` event
- ✅ **Solusi 2:** Create new event `new_room_complete` di backend (RECOMMENDED)
- ✅ **Solusi 3:** Frontend fetch after socket event (quick fix)
