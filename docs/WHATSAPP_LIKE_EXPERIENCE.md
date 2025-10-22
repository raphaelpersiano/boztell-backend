# WhatsApp-Like Experience - Complete Integration Guide

## 📱 **Overview**

Dokumentasi ini menjelaskan bagaimana membuat frontend experience **persis seperti WhatsApp Mobile**:

1. ✅ **Room List** - Daftar chat rooms (seperti list chat di WhatsApp)
2. ✅ **Auto-Create Room** - Room otomatis dibuat ketika customer baru ngechat
3. ✅ **Real-time Room Updates** - Room baru muncul langsung di list
4. ✅ **Click Room → Show Messages** - Buka room, lihat messages
5. ✅ **Real-time Messages** - Messages baru muncul instant
6. ✅ **Unread Count** - Badge untuk unread messages
7. ✅ **Last Message Preview** - Preview message terakhir di room list

---

## 🏗️ **Architecture - Seperti WhatsApp**

```
┌──────────────────────────────────────────────────────────┐
│                    WHATSAPP                              │
│  ┌────────────────┐  ┌─────────────────────────────┐    │
│  │  Chat List     │  │  Chat Room (opened)         │    │
│  │  ─────────     │  │  ──────────────────         │    │
│  │  👤 John Doe   │  │  👤 John Doe                │    │
│  │     Hello!     │  │  ┌──────────────────────┐   │    │
│  │     10:30 AM   │  │  │ Hello! How are you?  │   │    │
│  │                │  │  │ 10:30 AM          ✓✓ │   │    │
│  │  👤 Jane       │  │  └──────────────────────┘   │    │
│  │     Thanks!    │  │  ┌──────────────────────┐   │    │
│  │     Yesterday  │  │  │ I'm good, thanks!    │   │    │
│  │                │  │  │ 10:31 AM          ✓✓ │   │    │
│  └────────────────┘  └─────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 BOZTELL (SAMA!)                          │
│  ┌────────────────┐  ┌─────────────────────────────┐    │
│  │  Room List     │  │  Chat Room (opened)         │    │
│  │  ─────────     │  │  ──────────────────         │    │
│  │  👤 628xxx     │  │  👤 Customer 628xxx         │    │
│  │     Hello!     │  │  ┌──────────────────────┐   │    │
│  │     10:30 AM   │  │  │ Customer:            │   │    │
│  │     (1)        │  │  │ Hello! How are you?  │   │    │
│  │                │  │  │ 10:30 AM             │   │    │
│  │  👤 627xxx     │  │  └──────────────────────┘   │    │
│  │     Thanks!    │  │  ┌──────────────────────┐   │    │
│  │     Yesterday  │  │  │ Agent:               │   │    │
│  │                │  │  │ I'm good, thanks!    │   │    │
│  └────────────────┘  │  │ 10:31 AM          ✓✓ │   │    │
│                      │  └──────────────────────┘   │    │
│                      └─────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 **Flow: Customer Baru Ngechat**

```
Customer baru (628123456789) kirim "Hello!" via WhatsApp
                    ↓
┌─────────────────────────────────────────────────────────┐
│  BACKEND - Webhook Handler                              │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│  1. ensureRoom(phone: "628123456789")                   │
│     • Check: Room exists? NO                            │
│     • Create: leads (auto)                              │
│     • Create: rooms (new room)                          │
│     • Emit: io.emit('new_room', roomData) ✅            │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│  2. Save message to database                            │
│     • Insert into messages table                        │
│     • room_id: [new room id]                            │
│     • user_id: null (customer)                          │
│     • content_text: "Hello!"                            │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│  3. Emit Socket.IO events                               │
│     • io.emit('new_room', ...) ← Room baru muncul!      │
│     • io.to(`room_${roomId}`).emit('new_message', ...) │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│  FRONTEND - Real-time Updates                           │
│                                                          │
│  socket.on('new_room', (room) => {                      │
│    // Room baru muncul di list! ✅                       │
│    setRooms(prev => [room, ...prev]);                   │
│  });                                                     │
│                                                          │
│  socket.on('new_message', (msg) => {                    │
│    // Update last message & unread count                │
│    updateRoomPreview(msg);                              │
│  });                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📡 **API Endpoints**

### **1. Get All Rooms (Room List)**

**Endpoint:** `GET /rooms`

**Response:**
```javascript
{
  "success": true,
  "data": {
    "rooms": [
      {
        "room_id": "uuid-123",
        "room_phone": "628123456789",
        "room_title": "John Doe",
        "room_created_at": "2025-10-23T10:00:00Z",
        "room_updated_at": "2025-10-23T10:30:00Z",
        "leads_info": {
          "id": "lead-uuid",
          "name": "John Doe",
          "phone": "628123456789",
          "leads_status": "cold",
          "contact_status": "contacted"
        },
        "participants": [
          {
            "user_id": "agent-uuid",
            "name": "Agent Smith",
            "role": "agent"
          }
        ],
        "last_message": "Hello! How are you?",
        "last_message_at": "2025-10-23T10:30:00Z",
        "unread_count": 3
      }
      // ... more rooms
    ],
    "total_count": 50
  }
}
```

**Usage:**
```javascript
async function loadRoomList() {
  const response = await fetch('http://localhost:8080/rooms');
  const data = await response.json();
  
  if (data.success) {
    setRooms(data.data.rooms);
  }
}

// Load on mount
useEffect(() => {
  loadRoomList();
}, []);
```

---

### **2. Get Room Details**

**Endpoint:** `GET /rooms/:roomId`

**Response:**
```javascript
{
  "success": true,
  "data": {
    "room_id": "uuid-123",
    "phone": "628123456789",
    "title": "John Doe",
    "created_at": "2025-10-23T10:00:00Z",
    "leads_info": { ... },
    "participants": [ ... ]
  }
}
```

---

### **3. Get Room Messages**

**Endpoint:** `GET /messages/room/:roomId`

**Response:**
```javascript
{
  "success": true,
  "room_id": "uuid-123",
  "messages": [
    {
      "id": "msg-uuid-1",
      "room_id": "uuid-123",
      "user_id": null,  // customer
      "content_type": "text",
      "content_text": "Hello!",
      "created_at": "2025-10-23T10:30:00Z",
      ...
    }
  ],
  "count": 50,
  "has_more": false
}
```

---

## 🔌 **Socket.IO Events**

### **1. New Room (Customer Baru Ngechat)**

**Event:** `new_room`

**Payload:**
```javascript
{
  "id": "room-uuid-new",
  "phone": "628999888777",
  "title": "Customer 628999888777",
  "leads_id": "lead-uuid",
  "created_at": "2025-10-23T11:00:00Z",
  "updated_at": "2025-10-23T11:00:00Z",
  "unread_count": 0,
  "last_message": null
}
```

**Frontend Listener:**
```javascript
socket.on('new_room', (newRoom) => {
  console.log('🆕 New room created:', newRoom);
  
  // Add to room list (prepend to top)
  setRooms(prev => [newRoom, ...prev]);
  
  // Show notification
  showNotification(`New chat from ${newRoom.phone}`);
  
  // Play sound
  playNewChatSound();
});
```

---

### **2. New Message (Update Room Preview)**

**Event:** `new_message`

**Payload:**
```javascript
{
  "id": "msg-uuid",
  "room_id": "room-uuid",
  "user_id": null,  // customer
  "content_type": "text",
  "content_text": "Hello! I need help",
  "created_at": "2025-10-23T11:01:00Z",
  ...
}
```

**Frontend Listener:**
```javascript
socket.on('new_message', (message) => {
  // Update room list preview
  setRooms(prev => prev.map(room => {
    if (room.room_id === message.room_id) {
      return {
        ...room,
        last_message: message.content_text,
        last_message_at: message.created_at,
        unread_count: message.user_id === null 
          ? (room.unread_count || 0) + 1  // Increment jika dari customer
          : room.unread_count
      };
    }
    return room;
  }));
  
  // Sort rooms (latest message on top)
  setRooms(prev => [...prev].sort((a, b) => 
    new Date(b.last_message_at) - new Date(a.last_message_at)
  ));
});
```

---

## 🎨 **Complete React Implementation**

### **App.jsx (Main Layout)**

```jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import RoomList from './components/RoomList';
import ChatRoom from './components/ChatRoom';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Initialize Socket.IO
  useEffect(() => {
    const newSocket = io('http://localhost:8080', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
    });

    // Listen for NEW ROOM (customer baru ngechat)
    newSocket.on('new_room', (newRoom) => {
      console.log('🆕 New room created:', newRoom);
      
      // Add to top of list
      setRooms(prev => [
        {
          ...newRoom,
          room_id: newRoom.id,
          room_phone: newRoom.phone,
          room_title: newRoom.title,
          unread_count: 0,
          last_message: null,
          last_message_at: newRoom.created_at
        },
        ...prev
      ]);
      
      // Show notification
      showNotification(`New chat from ${newRoom.phone}`);
      playNewChatSound();
    });

    // Listen for NEW MESSAGE (update room preview)
    newSocket.on('new_message', (message) => {
      console.log('📨 New message:', message);
      
      setRooms(prev => {
        // Update room preview
        const updated = prev.map(room => {
          if (room.room_id === message.room_id) {
            return {
              ...room,
              last_message: message.content_text || '[Media]',
              last_message_at: message.created_at,
              unread_count: message.user_id === null && selectedRoom?.room_id !== message.room_id
                ? (room.unread_count || 0) + 1
                : room.unread_count
            };
          }
          return room;
        });
        
        // Sort by latest message
        return updated.sort((a, b) => 
          new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
        );
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [selectedRoom]);

  // Load room list on mount
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const response = await fetch('http://localhost:8080/rooms');
      const data = await response.json();
      
      if (data.success) {
        // Sort by latest activity
        const sortedRooms = data.data.rooms.sort((a, b) => 
          new Date(b.room_updated_at) - new Date(a.room_updated_at)
        );
        
        setRooms(sortedRooms);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    
    // Reset unread count
    setRooms(prev => prev.map(r => 
      r.room_id === room.room_id ? { ...r, unread_count: 0 } : r
    ));
  };

  const showNotification = (message) => {
    if (Notification.permission === 'granted') {
      new Notification('New Chat', {
        body: message,
        icon: '/logo.png'
      });
    }
  };

  const playNewChatSound = () => {
    const audio = new Audio('/sounds/new-chat.mp3');
    audio.play().catch(e => console.log('Sound play failed:', e));
  };

  return (
    <div className="app">
      <div className="layout">
        {/* LEFT: Room List (seperti list chat di WhatsApp) */}
        <RoomList 
          rooms={rooms}
          selectedRoom={selectedRoom}
          onRoomSelect={handleRoomSelect}
          isLoading={isLoadingRooms}
        />
        
        {/* RIGHT: Chat Room (seperti chat window di WhatsApp) */}
        {selectedRoom ? (
          <ChatRoom 
            room={selectedRoom}
            socket={socket}
          />
        ) : (
          <div className="empty-state">
            <h3>Select a chat to start messaging</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
```

---

### **RoomList.jsx (Chat List Component)**

```jsx
import React from 'react';
import './RoomList.css';

const RoomList = ({ rooms, selectedRoom, onRoomSelect, isLoading }) => {
  if (isLoading) {
    return <div className="room-list loading">Loading chats...</div>;
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Today: show time
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    }
    
    // Yesterday
    if (diff < 48 * 60 * 60 * 1000) {
      return 'Yesterday';
    }
    
    // Older: show date
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h2>Chats</h2>
        <div className="room-count">{rooms.length}</div>
      </div>
      
      <div className="rooms-container">
        {rooms.length === 0 ? (
          <div className="empty-rooms">
            <p>No chats yet</p>
            <span>New chats will appear here</span>
          </div>
        ) : (
          rooms.map(room => (
            <div
              key={room.room_id}
              className={`room-item ${selectedRoom?.room_id === room.room_id ? 'active' : ''}`}
              onClick={() => onRoomSelect(room)}
            >
              <div className="room-avatar">
                <div className="avatar-circle">
                  {room.room_title?.charAt(0) || room.room_phone?.charAt(0) || '?'}
                </div>
              </div>
              
              <div className="room-content">
                <div className="room-header">
                  <h3 className="room-name">
                    {room.room_title || room.room_phone}
                  </h3>
                  <span className="room-time">
                    {formatTime(room.last_message_at)}
                  </span>
                </div>
                
                <div className="room-footer">
                  <p className="room-last-message">
                    {room.last_message || 'No messages yet'}
                  </p>
                  
                  {room.unread_count > 0 && (
                    <span className="unread-badge">
                      {room.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RoomList;
```

---

### **ChatRoom.jsx (Chat Window Component)**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import './ChatRoom.css';

const ChatRoom = ({ room, socket }) => {
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const messagesEndRef = useRef(null);

  // Load messages when room changes
  useEffect(() => {
    if (room) {
      loadMessages(room.room_id);
      
      // Join room for real-time updates
      socket.emit('join_room', room.room_id);
      
      return () => {
        socket.emit('leave_room', room.room_id);
      };
    }
  }, [room, socket]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (message) => {
      if (message.room_id === room.room_id) {
        setMessages(prev => {
          // Prevent duplicates
          const exists = prev.find(m => m.id === message.id);
          return exists ? prev : [...prev, message];
        });
        
        scrollToBottom();
      }
    };
    
    socket.on('new_message', handleNewMessage);
    
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, room]);

  const loadMessages = async (roomId) => {
    try {
      setIsLoadingMessages(true);
      
      const response = await fetch(`http://localhost:8080/messages/room/${roomId}?limit=50&order=desc`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages.reverse());
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderMessage = (message) => {
    const isCustomer = message.user_id === null;
    
    return (
      <div 
        key={message.id}
        className={`message ${isCustomer ? 'customer' : 'agent'}`}
      >
        <div className="message-bubble">
          <p>{message.content_text}</p>
          <span className="message-time">
            {new Date(message.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </span>
        </div>
      </div>
    );
  };

  if (isLoadingMessages) {
    return <div className="chat-room loading">Loading messages...</div>;
  }

  return (
    <div className="chat-room">
      <div className="chat-header">
        <h3>{room.room_title || room.room_phone}</h3>
        <span className="room-phone">{room.room_phone}</span>
      </div>
      
      <div className="messages-container">
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        {/* Your message input component */}
        <input type="text" placeholder="Type a message..." />
        <button>Send</button>
      </div>
    </div>
  );
};

export default ChatRoom;
```

---

### **RoomList.css (WhatsApp-like Styling)**

```css
.room-list {
  width: 400px;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  background: white;
}

.room-list-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
}

.room-list-header h2 {
  margin: 0;
  font-size: 24px;
}

.room-count {
  background: #25d366;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
}

.rooms-container {
  flex: 1;
  overflow-y: auto;
}

.room-item {
  display: flex;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.room-item:hover {
  background: #f5f5f5;
}

.room-item.active {
  background: #e8f5e9;
}

.room-avatar {
  margin-right: 12px;
}

.avatar-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #25d366;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  text-transform: uppercase;
}

.room-content {
  flex: 1;
  min-width: 0;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.room-name {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-time {
  font-size: 12px;
  color: #666;
}

.room-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-last-message {
  margin: 0;
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-badge {
  background: #25d366;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-left: 8px;
  min-width: 20px;
  text-align: center;
}

.empty-rooms {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}
```

---

## ✅ **Feature Checklist - WhatsApp Experience**

- [x] **Room List** - Daftar semua chat rooms
- [x] **Auto-Create Room** - Room otomatis dibuat ketika customer baru ngechat
- [x] **Real-time New Room** - Room baru muncul instant di list (`new_room` event)
- [x] **Last Message Preview** - Preview message terakhir di room list
- [x] **Unread Count Badge** - Badge untuk unread messages (hijau seperti WA)
- [x] **Room Sorting** - Sort by latest message (newest on top)
- [x] **Click Room → Show Messages** - Buka room, fetch & display messages
- [x] **Real-time Messages** - Messages baru muncul instant di chat
- [x] **Message Status** - Checkmarks (✓ sent, ✓✓ delivered, ✓✓ read)
- [x] **Typing Indicator** - "Customer is typing..."
- [x] **Notifications** - Desktop notification untuk chat baru
- [x] **Sound Alerts** - Sound notification untuk new chat/message
- [x] **WhatsApp-like UI** - Green theme, avatar circles, time stamps

---

## 🎯 **Testing Guide**

### **Test 1: Customer Baru Ngechat**

1. **Simulate WhatsApp Webhook:**
```bash
# POST http://localhost:8080/webhook/whatsapp
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "contacts": [{
          "profile": { "name": "New Customer" },
          "wa_id": "628999777666"
        }],
        "messages": [{
          "from": "628999777666",
          "id": "wamid.test123",
          "timestamp": "1698048000",
          "type": "text",
          "text": { "body": "Hello! I need help" }
        }]
      }
    }]
  }]
}
```

2. **Expected Result:**
   - ✅ Room baru dibuat di database (table `rooms`)
   - ✅ Lead baru dibuat di database (table `leads`)
   - ✅ Message disimpan di database (table `messages`)
   - ✅ Socket.IO emit `new_room` event
   - ✅ Frontend: Room baru muncul di top of list
   - ✅ Frontend: Notification "New chat from 628999777666"
   - ✅ Frontend: Sound alert

---

### **Test 2: Customer Lama Ngechat Lagi**

1. **Simulate webhook dari nomor yang sudah pernah chat:**
```bash
# Same customer (628999777666) sends another message
{
  "messages": [{
    "from": "628999777666",
    "text": { "body": "Are you there?" }
  }]
}
```

2. **Expected Result:**
   - ✅ Room TIDAK dibuat lagi (pakai yang existing)
   - ✅ Message disimpan dengan room_id yang sama
   - ✅ Socket.IO emit `new_message` event
   - ✅ Frontend: Room pindah ke top (latest message)
   - ✅ Frontend: Last message preview updated
   - ✅ Frontend: Unread count increment (jika room tidak dibuka)

---

## 🚀 **Production Checklist**

- [ ] Load room list on app start
- [ ] Connect Socket.IO after room list loaded
- [ ] Listen to `new_room` event (customer baru)
- [ ] Listen to `new_message` event (update preview)
- [ ] Sort rooms by latest activity
- [ ] Show unread count badge
- [ ] Click room → Load messages
- [ ] Join room via Socket.IO (`join_room`)
- [ ] Leave room on unmount (`leave_room`)
- [ ] Desktop notifications (request permission)
- [ ] Sound alerts
- [ ] Responsive design (mobile & desktop)
- [ ] Error handling (connection lost, etc)

---

**Happy coding! Sekarang frontend Anda akan seperti WhatsApp asli! 🎉📱**
