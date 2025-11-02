# Frontend Integration Guide - Socket.IO Events

## 🎯 Overview
Backend sekarang emit event `new_room_complete` untuk room baru dengan full data (room + first message + leads info). Ini menghilangkan race condition dan membuat UX smooth.

---

## 📡 Socket Events to Listen

### 1. `new_room_complete` Event (NEW ROOM)

**Kapan di-emit:**
- Customer baru pertama kali chat (room baru dibuat)
- Di-emit SETELAH first message tersimpan
- Include full room data + first message + leads info

**Payload Structure:**
```typescript
{
  // Room data
  room_id: string;
  room_phone: string;
  room_title: string;
  room_created_at: string;
  room_updated_at: string;
  
  // Leads info (FULL DATA)
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
  
  // First message
  last_message: {
    id: string;
    content_text: string;
    content_type: string;
    created_at: string;
    user_id: string | null; // null = customer
    wa_message_id: string;
  };
  
  // Helper fields (same data as last_message, for convenience)
  last_message_text: string;
  last_message_timestamp: string;
  last_message_type: string;
  
  // Counts
  unread_count: number; // Always 1 for new room
  message_count: number; // Always 1 for new room
  
  // Participants
  participants: Array<{
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_role: string;
    joined_at: string;
  }>;
}
```

**Example Payload:**
```javascript
{
  room_id: "7e956fc9-d64b-4e77-9fd5-1cafc1588b41",
  room_phone: "6287879565390",
  room_title: "John Doe",
  room_created_at: "2025-11-02T10:30:00.000Z",
  room_updated_at: "2025-11-02T10:30:00.000Z",
  
  leads_id: "abc123-def456-789",
  leads_info: {
    id: "abc123-def456-789",
    utm_id: null,
    name: "John Doe",
    phone: "6287879565390",
    outstanding: 50000000,
    loan_type: "personal_loan",
    leads_status: "cold",
    contact_status: "contacted"
  },
  
  last_message: {
    id: "msg-uuid-123",
    content_text: "Hello, saya mau tanya produk KPR",
    content_type: "text",
    created_at: "2025-11-02T10:30:05.000Z",
    user_id: null,
    wa_message_id: "wamid.HBgNNjI4Nzg3OTU2NTM5MBU..."
  },
  
  last_message_text: "Hello, saya mau tanya produk KPR",
  last_message_timestamp: "2025-11-02T10:30:05.000Z",
  last_message_type: "text",
  
  unread_count: 1,
  message_count: 1,
  
  participants: []
}
```

**Frontend Implementation:**
```typescript
// React example
socket.on('new_room_complete', (room) => {
  console.log('[Socket] 🆕 New room with complete data:', room);
  
  // ✅ Add to rooms list (data sudah lengkap!)
  setRooms(prev => [room, ...prev]);
  
  // ✅ Play notification sound
  playNotificationSound();
  
  // ✅ Show toast notification
  toast.info(`New message from ${room.leads_info?.name || room.room_phone}`);
  
  // ✅ Update unread badge
  setTotalUnread(prev => prev + 1);
});
```

---

### 2. `new_message` Event (EXISTING ROOM)

**Kapan di-emit:**
- Customer existing chat lagi (room sudah ada)
- Agent mengirim message
- Di-emit untuk SEMUA messages (termasuk first message, untuk backward compatibility)

**Payload Structure:**
```typescript
{
  id: string;
  room_id: string;
  user_id: string | null; // null = customer, uuid = agent
  content_type: string; // text, image, video, audio, document, etc.
  content_text: string | null;
  wa_message_id: string | null;
  status: string; // sent, delivered, read
  reply_to_wa_message_id: string | null;
  reaction_emoji: string | null;
  reaction_to_wa_message_id: string | null;
  status_timestamp: string | null;
  
  // Media fields
  media_type: string | null;
  media_id: string | null;
  gcs_filename: string | null;
  gcs_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  original_filename: string | null;
  
  // Metadata
  metadata: object | null;
  created_at: string;
  updated_at: string;
}
```

**Frontend Implementation:**
```typescript
socket.on('new_message', (message) => {
  console.log('[Socket] 💬 New message:', message);
  
  // ✅ Update rooms list (last_message, unread_count, timestamp)
  setRooms(prev => prev.map(room => {
    if (room.room_id === message.room_id) {
      return {
        ...room,
        last_message: {
          id: message.id,
          content_text: message.content_text,
          content_type: message.content_type,
          created_at: message.created_at,
          user_id: message.user_id,
          wa_message_id: message.wa_message_id
        },
        last_message_text: message.content_text,
        last_message_timestamp: message.created_at,
        last_message_type: message.content_type,
        room_updated_at: message.created_at,
        
        // Update unread count (jika bukan room yang sedang dibuka)
        unread_count: room.room_id === currentRoomId 
          ? 0 
          : (room.unread_count || 0) + 1
      };
    }
    return room;
  }));
  
  // ✅ Update messages (jika room sedang dibuka)
  if (currentRoomId === message.room_id) {
    setMessages(prev => [...prev, message]);
    
    // Mark as read jika window focused
    if (document.hasFocus()) {
      markAsRead(message.room_id);
    }
  } else {
    // Play notification jika dari room lain
    playNotificationSound();
  }
  
  // ✅ Update total unread badge
  if (message.room_id !== currentRoomId) {
    setTotalUnread(prev => prev + 1);
  }
});
```

---

### 3. `room:new_message` Event (ROOM-SPECIFIC)

**Kapan di-emit:**
- Same as `new_message`, tapi hanya ke clients yang sudah join room
- Best practice untuk scalability

**Payload Structure:**
- Sama dengan `new_message`

**Frontend Implementation:**
```typescript
// Join room saat buka chat window
useEffect(() => {
  if (roomId) {
    socket.emit('room:join', { room_id: roomId });
    
    return () => {
      socket.emit('room:leave', { room_id: roomId });
    };
  }
}, [roomId]);

// Listen for messages in this room only
socket.on('room:new_message', (message) => {
  console.log('[Socket] 📨 Room message:', message);
  
  // Update messages list
  setMessages(prev => [...prev, message]);
  
  // Auto scroll to bottom
  scrollToBottom();
});
```

---

## 🎨 Complete Frontend Example

### Setup Socket Connection

```typescript
// src/hooks/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(url: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to socket server
    socketRef.current = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[Socket] ✅ Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] ❌ Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [url]);

  return { socket: socketRef.current, isConnected };
}
```

### Handle Socket Events

```typescript
// src/hooks/useRoomSocket.ts
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface UseRoomSocketProps {
  socket: Socket | null;
  currentRoomId: string | null;
  onNewRoomComplete: (room: any) => void;
  onNewMessage: (message: any) => void;
}

export function useRoomSocket({
  socket,
  currentRoomId,
  onNewRoomComplete,
  onNewMessage
}: UseRoomSocketProps) {
  useEffect(() => {
    if (!socket) return;

    // Listen for new room with complete data
    socket.on('new_room_complete', (room) => {
      console.log('[Socket] 🆕 New room complete:', room);
      onNewRoomComplete(room);
    });

    // Listen for new messages in existing rooms
    socket.on('new_message', (message) => {
      console.log('[Socket] 💬 New message:', message);
      onNewMessage(message);
    });

    return () => {
      socket.off('new_room_complete');
      socket.off('new_message');
    };
  }, [socket, onNewRoomComplete, onNewMessage]);

  // Join/leave current room
  useEffect(() => {
    if (!socket || !currentRoomId) return;

    socket.emit('room:join', { room_id: currentRoomId });
    console.log('[Socket] 📍 Joined room:', currentRoomId);

    return () => {
      socket.emit('room:leave', { room_id: currentRoomId });
      console.log('[Socket] 👋 Left room:', currentRoomId);
    };
  }, [socket, currentRoomId]);
}
```

### Sidebar Component

```typescript
// src/components/Sidebar.tsx
import React, { useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useRoomSocket } from '../hooks/useRoomSocket';

export function Sidebar() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  
  const { socket, isConnected } = useSocket('http://localhost:8080');

  // Handle new room complete event
  const handleNewRoomComplete = useCallback((room: Room) => {
    console.log('🆕 New room received with complete data:', room);
    
    // ✅ Add to rooms list (data already complete!)
    setRooms(prev => {
      // Check if room already exists (prevent duplicates)
      const exists = prev.some(r => r.room_id === room.room_id);
      if (exists) {
        return prev.map(r => r.room_id === room.room_id ? room : r);
      }
      return [room, ...prev];
    });
    
    // ✅ Play notification sound
    playNotificationSound();
    
    // ✅ Show toast
    toast.info(`New message from ${room.leads_info?.name || room.room_phone}`);
  }, []);

  // Handle new message event
  const handleNewMessage = useCallback((message: Message) => {
    console.log('💬 New message received:', message);
    
    // ✅ Update rooms list
    setRooms(prev => prev.map(room => {
      if (room.room_id === message.room_id) {
        const isCurrentRoom = room.room_id === currentRoomId;
        
        return {
          ...room,
          last_message: {
            id: message.id,
            content_text: message.content_text,
            content_type: message.content_type,
            created_at: message.created_at,
            user_id: message.user_id,
            wa_message_id: message.wa_message_id
          },
          last_message_text: message.content_text,
          last_message_timestamp: message.created_at,
          last_message_type: message.content_type,
          room_updated_at: message.created_at,
          unread_count: isCurrentRoom ? 0 : (room.unread_count || 0) + 1
        };
      }
      return room;
    }));
    
    // ✅ Play sound if not current room
    if (message.room_id !== currentRoomId) {
      playNotificationSound();
    }
  }, [currentRoomId]);

  // Setup socket listeners
  useRoomSocket({
    socket,
    currentRoomId,
    onNewRoomComplete: handleNewRoomComplete,
    onNewMessage: handleNewMessage
  });

  return (
    <div className="sidebar">
      <div className="connection-status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      <div className="rooms-list">
        {rooms.map(room => (
          <RoomItem
            key={room.room_id}
            room={room}
            isActive={room.room_id === currentRoomId}
            onClick={() => setCurrentRoomId(room.room_id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Room Item Component

```typescript
// src/components/RoomItem.tsx
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface RoomItemProps {
  room: Room;
  isActive: boolean;
  onClick: () => void;
}

export function RoomItem({ room, isActive, onClick }: RoomItemProps) {
  // ✅ Customer name dari leads_info (no more "Unknown")
  const customerName = room.leads_info?.name || room.room_title || room.room_phone;
  
  // ✅ Last message text
  const lastMessageText = room.last_message_text || 'No messages yet';
  
  // ✅ Timestamp relative
  const timeAgo = room.last_message_timestamp
    ? formatDistanceToNow(new Date(room.last_message_timestamp), { 
        addSuffix: true,
        locale: localeId 
      })
    : '';
  
  // ✅ Unread badge
  const unreadCount = room.unread_count || 0;

  return (
    <div 
      className={`room-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="room-avatar">
        {customerName[0].toUpperCase()}
      </div>
      
      <div className="room-info">
        <div className="room-header">
          <span className="customer-name">{customerName}</span>
          <span className="room-time">{timeAgo}</span>
        </div>
        
        <div className="room-message">
          <span className="last-message">{lastMessageText}</span>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🚀 Testing Guide

### Test 1: New Customer First Message

**Steps:**
1. Customer baru (belum pernah chat) kirim message
2. Check browser console untuk logs

**Expected Logs:**
```
[Socket] 🆕 New room complete: { room_id: "...", room_phone: "...", leads_info: {...}, last_message: {...} }
[Socket] 💬 New message: { id: "...", room_id: "...", content_text: "..." }
```

**Expected UI:**
1. ✅ Room muncul di sidebar
2. ✅ Customer name tampil (bukan "Unknown")
3. ✅ Last message tampil
4. ✅ Timestamp tampil
5. ✅ Unread badge = 1
6. ✅ Klik room → Messages langsung ada

### Test 2: Existing Customer Reply

**Steps:**
1. Customer yang sudah ada room-nya chat lagi
2. Check console

**Expected Logs:**
```
[Socket] 💬 New message: { id: "...", room_id: "...", content_text: "..." }
```

**Expected UI:**
1. ✅ Room update di sidebar (naik ke top)
2. ✅ Last message berubah
3. ✅ Timestamp update
4. ✅ Unread count +1
5. ✅ Jika room sedang dibuka → Message langsung append

### Test 3: Multiple Customers Simultaneously

**Steps:**
1. 3 customer berbeda chat bersamaan
2. Check UI behavior

**Expected UI:**
1. ✅ 3 rooms muncul bersamaan
2. ✅ Semua dengan data lengkap
3. ✅ Tidak ada "Unknown" customer
4. ✅ Tidak ada empty room window
5. ✅ Unread badges correct

---

## 🎯 Benefits of This Implementation

### ✅ No Race Condition
- Room data dan first message datang bersamaan
- Tidak perlu fetch tambahan setelah socket event
- UI langsung complete saat room muncul

### ✅ Better UX
- Customer name langsung tampil (bukan "Unknown")
- Last message langsung ada (bukan empty)
- Tidak perlu refresh untuk lihat data lengkap

### ✅ Performance
- Reduce API calls (no additional fetch)
- Single event dengan full data
- Efficient data transfer

### ✅ Maintainable
- Clear separation: `new_room_complete` vs `new_message`
- Backward compatible dengan existing `new_message` event
- Easy to debug dengan clear event names

---

## 📝 Migration Checklist

- [ ] Update frontend socket listeners
- [ ] Replace `new_room` with `new_room_complete`
- [ ] Test dengan customer baru
- [ ] Test dengan customer existing
- [ ] Test simultaneous multiple customers
- [ ] Remove any workaround fetch calls
- [ ] Update TypeScript interfaces/types
- [ ] Test notification sounds & badges
- [ ] Verify no memory leaks (socket cleanup)
- [ ] Production deployment

---

Selamat coding! 🚀 Kalau ada masalah atau pertanyaan, check console logs untuk debugging.
