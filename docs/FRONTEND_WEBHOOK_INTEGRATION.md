# Frontend Integration Guide - WhatsApp Webhook & Real-time Updates

## 📋 Overview

Dokumentasi ini menjelaskan bagaimana frontend dapat mengintegrasikan dengan backend untuk menerima **real-time updates** dari WhatsApp messages menggunakan **Socket.IO**.

**Backend Tech Stack:**
- Express.js REST API
- Socket.IO untuk real-time communication
- Supabase PostgreSQL untuk database

**Base URL:** `http://localhost:8080` (development)

---

## 🔌 Socket.IO Integration

### 1. Installation

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### 2. Initialize Connection

```javascript
import { io } from 'socket.io-client';

// Connect to backend
const socket = io('http://localhost:8080', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection status
socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

---

## 🏠 Room Management

### Join Room (Ketika agent membuka chat room)

```javascript
// Join room untuk mulai menerima updates
function joinRoom(roomId) {
  socket.emit('join_room', roomId);
  console.log(`Joined room: ${roomId}`);
}

// Example: Agent membuka chat dengan customer
joinRoom('room_123');
```

### Leave Room (Ketika agent menutup chat room)

```javascript
// Leave room untuk stop menerima updates
function leaveRoom(roomId) {
  socket.emit('leave_room', roomId);
  console.log(`Left room: ${roomId}`);
}

// Example: Agent menutup chat
leaveRoom('room_123');
```

---

## 📨 Real-time Events

### 1. **New Message** (Incoming WhatsApp Message)

Triggered ketika customer mengirim pesan WhatsApp.

```javascript
socket.on('new_message', (message) => {
  console.log('New message received:', message);
  
  // Add message ke chat UI
  addMessageToChat(message);
  
  // Update unread count
  updateUnreadCount(message.room_id);
  
  // Play notification sound
  if (message.user_id === null) { // null = customer message
    playNotificationSound();
    showDesktopNotification(message);
  }
});
```

**Message Object Structure:**
```javascript
{
  "id": "uuid",                           // Message ID (database)
  "room_id": "uuid",                      // Room ID
  "user_id": null,                        // null = customer, uuid = agent
  "content_type": "text",                 // text, media, location, contacts, etc
  "content_text": "Hello, how can I help?", // Message content
  "wa_message_id": "wamid.xxx",          // WhatsApp message ID
  "status": "received",                   // received, sent, delivered, read
  "created_at": "2025-10-23T10:30:00Z",  // Timestamp
  "updated_at": "2025-10-23T10:30:00Z",
  
  // Optional fields (depending on content_type)
  "media_type": "image",                  // image, video, audio, document, sticker
  "media_id": "media_id_from_whatsapp",
  "gcs_url": "https://storage.googleapis.com/...", // Media URL (if media)
  "gcs_filename": "filename.jpg",
  "mime_type": "image/jpeg",
  "file_size": 1024000,
  "original_filename": "photo.jpg",
  
  // Reply & Reaction fields
  "reply_to_wa_message_id": "wamid.original", // If this is a reply
  "reaction_emoji": "👍",                     // If this is a reaction
  "reaction_to_wa_message_id": "wamid.xxx",   // Message being reacted to
  
  // Metadata (JSON string)
  "metadata": "{\"timestamp\":\"...\",\"context\":\"...\"}"
}
```

---

### 2. **Message Status Update** (Delivered/Read Receipts)

Triggered ketika status message berubah (sent → delivered → read).

```javascript
socket.on('message_status_update', (statusUpdate) => {
  console.log('Status update:', statusUpdate);
  
  // Update message checkmark di UI
  updateMessageStatus(statusUpdate);
});
```

**Status Update Object:**
```javascript
{
  "wa_message_id": "wamid.xxx",           // WhatsApp message ID
  "status": "read",                       // sent, delivered, read, failed
  "status_timestamp": "2025-10-23T10:31:00Z",
  "room_id": "uuid"                       // Room ID
}
```

**Status Visual (WhatsApp-style):**
- `sent`: ✓ (single checkmark, gray)
- `delivered`: ✓✓ (double checkmark, gray)
- `read`: ✓✓ (double checkmark, blue)
- `failed`: ❌ (red)

---

### 3. **Typing Indicator**

Triggered ketika customer sedang mengetik.

```javascript
socket.on('typing_indicator', (data) => {
  console.log('Typing indicator:', data);
  
  if (data.is_typing) {
    showTypingIndicator(data.room_id, data.user);
  } else {
    hideTypingIndicator(data.room_id);
  }
});
```

**Typing Indicator Object:**
```javascript
{
  "room_id": "uuid",
  "is_typing": true,                      // true or false
  "user": "Customer"                      // or agent name
}
```

**UI Example:**
```
┌────────────────────────────┐
│  Customer is typing...     │
│  ●●●                        │
└────────────────────────────┘
```

---

### 4. **Agent Assignment**

Triggered ketika agent di-assign atau di-unassign dari room.

```javascript
socket.on('agent_assigned', (data) => {
  console.log('Agent assigned:', data);
  
  // Update UI untuk show assigned agent
  updateRoomAgent(data);
  
  // Show notification
  if (data.agent_id === currentUser.id) {
    showNotification('You have been assigned to this chat');
  }
});

socket.on('agent_unassigned', (data) => {
  console.log('Agent unassigned:', data);
  
  // Update UI
  removeRoomAgent(data);
});
```

**Agent Assignment Object:**
```javascript
{
  "room_id": "uuid",
  "agent_id": "uuid",
  "agent_name": "John Doe",
  "assigned_at": "2025-10-23T10:30:00Z"
}
```

---

## 📊 Message Types & Rendering

### 1. Text Message

```javascript
if (message.content_type === 'text') {
  return (
    <div className="message">
      <p>{message.content_text}</p>
      <span className="timestamp">{formatTime(message.created_at)}</span>
      <span className="status">{getStatusIcon(message.status)}</span>
    </div>
  );
}
```

---

### 2. Media Message (Image, Video, Audio, Document, Sticker)

```javascript
if (message.content_type === 'media') {
  switch (message.media_type) {
    case 'image':
      return (
        <div className="message media-message">
          <img src={message.gcs_url} alt="Image" />
          {message.content_text && <p>{message.content_text}</p>}
          <span className="timestamp">{formatTime(message.created_at)}</span>
        </div>
      );
      
    case 'video':
      return (
        <div className="message media-message">
          <video controls src={message.gcs_url} />
          {message.content_text && <p>{message.content_text}</p>}
        </div>
      );
      
    case 'audio':
      return (
        <div className="message media-message">
          <audio controls src={message.gcs_url} />
        </div>
      );
      
    case 'document':
      return (
        <div className="message media-message">
          <a href={message.gcs_url} download={message.original_filename}>
            📄 {message.original_filename || 'Download Document'}
          </a>
          <span className="file-size">{formatFileSize(message.file_size)}</span>
        </div>
      );
      
    case 'sticker':
      return (
        <div className="message sticker-message">
          <img src={message.gcs_url} alt="Sticker" className="sticker" />
        </div>
      );
  }
}
```

---

### 3. Location Message

```javascript
if (message.content_type === 'location') {
  const metadata = JSON.parse(message.metadata);
  const { latitude, longitude, name, address } = metadata.location;
  
  return (
    <div className="message location-message">
      <div className="location-preview">
        <img 
          src={`https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x200&markers=color:red%7C${latitude},${longitude}&key=YOUR_API_KEY`}
          alt="Location"
        />
      </div>
      <div className="location-info">
        {name && <strong>{name}</strong>}
        {address && <p>{address}</p>}
        <a 
          href={`https://www.google.com/maps?q=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          📍 Open in Google Maps
        </a>
      </div>
    </div>
  );
}
```

---

### 4. Contact Message

```javascript
if (message.content_type === 'contacts') {
  const metadata = JSON.parse(message.metadata);
  const contacts = metadata.contacts;
  
  return (
    <div className="message contacts-message">
      {contacts.map((contact, index) => (
        <div key={index} className="contact-card">
          <div className="contact-name">
            👤 {contact.name.formatted_name}
          </div>
          {contact.phones && contact.phones.map((phone, i) => (
            <div key={i} className="contact-phone">
              📱 {phone.phone}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

### 5. Reaction Message

```javascript
if (message.content_type === 'reaction') {
  // Find original message yang di-react
  const originalMessage = findMessageByWaId(message.reaction_to_wa_message_id);
  
  return (
    <div className="message reaction-message">
      <span className="reaction-emoji">{message.reaction_emoji}</span>
      <span className="reaction-to">
        Reacted to: "{originalMessage?.content_text}"
      </span>
    </div>
  );
}

// Or, tampilkan reaction di bawah original message
function renderReactions(message) {
  const reactions = getReactionsForMessage(message.wa_message_id);
  
  return (
    <div className="message-reactions">
      {reactions.map(reaction => (
        <span key={reaction.id} className="reaction">
          {reaction.reaction_emoji}
        </span>
      ))}
    </div>
  );
}
```

---

### 6. Reply Message

```javascript
if (message.reply_to_wa_message_id) {
  const originalMessage = findMessageByWaId(message.reply_to_wa_message_id);
  
  return (
    <div className="message reply-message">
      {/* Show original message being replied to */}
      <div className="replied-message">
        <div className="reply-line"></div>
        <div className="reply-content">
          <strong>{originalMessage?.user_id ? 'Agent' : 'Customer'}</strong>
          <p>{originalMessage?.content_text || '[Media]'}</p>
        </div>
      </div>
      
      {/* Show current reply */}
      <div className="message-content">
        <p>{message.content_text}</p>
      </div>
    </div>
  );
}
```

---

### 7. Interactive Button/List Reply

```javascript
if (message.content_type === 'interactive') {
  const metadata = JSON.parse(message.metadata);
  
  return (
    <div className="message interactive-message">
      <div className="interactive-reply">
        🔘 {message.content_text}
      </div>
      <span className="timestamp">{formatTime(message.created_at)}</span>
    </div>
  );
}
```

---

### 8. Order Message

```javascript
if (message.content_type === 'order') {
  const metadata = JSON.parse(message.metadata);
  const { order } = metadata;
  
  return (
    <div className="message order-message">
      <div className="order-header">
        🛒 Order ({order.product_items?.length || 0} items)
      </div>
      <div className="order-items">
        {order.product_items?.map((item, index) => (
          <div key={index} className="order-item">
            {item.product_name} x{item.quantity}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 9. System Message

```javascript
if (message.content_type === 'system') {
  return (
    <div className="message system-message">
      <span className="system-text">ℹ️ {message.content_text}</span>
    </div>
  );
}
```

**Examples:**
- "Customer clicked Get Started"
- "Customer number changed"
- "Business hours notification"

---

### 10. Unsupported Message

```javascript
if (message.content_type === 'unsupported') {
  return (
    <div className="message unsupported-message">
      <span className="unsupported-text">
        ⚠️ {message.content_text}
      </span>
      <p className="help-text">
        This message type is not supported by WhatsApp Business API
      </p>
    </div>
  );
}
```

---

## 🎨 Complete React Component Example

```jsx
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const ChatRoom = ({ roomId, currentUserId }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:8080', {
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    // Join room
    newSocket.emit('join_room', roomId);

    // Listen for new messages
    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
      
      // Play notification if from customer
      if (message.user_id === null) {
        playNotificationSound();
      }
    });

    // Listen for status updates
    newSocket.on('message_status_update', (statusUpdate) => {
      setMessages(prev => prev.map(msg => 
        msg.wa_message_id === statusUpdate.wa_message_id
          ? { ...msg, status: statusUpdate.status }
          : msg
      ));
    });

    // Listen for typing indicator
    newSocket.on('typing_indicator', (data) => {
      setIsTyping(data.is_typing);
      
      if (data.is_typing) {
        setTimeout(() => setIsTyping(false), 3000);
      }
    });

    // Cleanup on unmount
    return () => {
      newSocket.emit('leave_room', roomId);
      newSocket.disconnect();
    };
  }, [roomId]);

  const renderMessage = (message) => {
    const isCustomer = message.user_id === null;
    
    return (
      <div 
        key={message.id} 
        className={`message ${isCustomer ? 'customer' : 'agent'}`}
      >
        {/* Text message */}
        {message.content_type === 'text' && (
          <div className="message-bubble">
            <p>{message.content_text}</p>
            <div className="message-footer">
              <span className="time">
                {new Date(message.created_at).toLocaleTimeString()}
              </span>
              {!isCustomer && (
                <span className="status">
                  {getStatusIcon(message.status)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Media message */}
        {message.content_type === 'media' && (
          <div className="message-bubble media">
            {message.media_type === 'image' && (
              <img src={message.gcs_url} alt="Image" />
            )}
            {message.media_type === 'video' && (
              <video controls src={message.gcs_url} />
            )}
            {message.media_type === 'audio' && (
              <audio controls src={message.gcs_url} />
            )}
            {message.media_type === 'document' && (
              <a href={message.gcs_url} download>
                📄 {message.original_filename}
              </a>
            )}
            {message.content_text && <p>{message.content_text}</p>}
          </div>
        )}

        {/* Location message */}
        {message.content_type === 'location' && (
          <div className="message-bubble location">
            <div className="location-content">
              📍 Location shared
            </div>
          </div>
        )}
      </div>
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return <span className="read">✓✓</span>;
      case 'failed': return '❌';
      default: return '';
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play();
  };

  return (
    <div className="chat-room">
      <div className="messages-container">
        {messages.map(renderMessage)}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="typing-indicator">
            <span>Customer is typing</span>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;
```

---

## 🔧 Helper Functions

### Format Timestamp

```javascript
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Today: show time only
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // Yesterday
  if (diff < 48 * 60 * 60 * 1000) {
    return 'Yesterday ' + date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // Older: show date
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
```

### Format File Size

```javascript
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
```

### Desktop Notification

```javascript
function showDesktopNotification(message) {
  // Check permission
  if (Notification.permission === 'granted') {
    new Notification('New message from customer', {
      body: message.content_text || 'Media message',
      icon: '/logo.png',
      badge: '/badge.png',
      tag: message.room_id,
      requireInteraction: false
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showDesktopNotification(message);
      }
    });
  }
}
```

---

## 🚨 Error Handling

```javascript
// Connection errors
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  showToast('Connection error. Retrying...', 'error');
});

// Reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  showToast('Connected', 'success');
  
  // Re-join rooms
  currentRooms.forEach(roomId => {
    socket.emit('join_room', roomId);
  });
});

// Reconnection failed
socket.on('reconnect_failed', () => {
  console.error('Reconnection failed');
  showToast('Unable to connect to server', 'error');
});
```

---

## 📱 Mobile App (React Native) Integration

```javascript
import io from 'socket.io-client';

// Same implementation as web
const socket = io('http://your-backend-url:8080', {
  transports: ['websocket'],
  reconnection: true
});

// For background notifications
import PushNotification from 'react-native-push-notification';

socket.on('new_message', (message) => {
  if (message.user_id === null) { // Customer message
    PushNotification.localNotification({
      title: 'New message',
      message: message.content_text || 'Media message',
      playSound: true,
      soundName: 'default'
    });
  }
});
```

---

## 🔐 Authentication (Future)

Jika nanti backend menambahkan authentication:

```javascript
const socket = io('http://localhost:8080', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Server will verify token before accepting connection
socket.on('connect_error', (error) => {
  if (error.message === 'Authentication failed') {
    // Redirect to login
    redirectToLogin();
  }
});
```

---

## 📊 Testing dengan Postman/Thunder Client

### Test Webhook (Simulate WhatsApp message)

```http
POST http://localhost:8080/webhook/whatsapp
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "6281234567890",
          "phone_number_id": "phone_number_id"
        },
        "contacts": [{
          "profile": {
            "name": "John Doe"
          },
          "wa_id": "628123456789"
        }],
        "messages": [{
          "from": "628123456789",
          "id": "wamid.test123",
          "timestamp": "1698048000",
          "type": "text",
          "text": {
            "body": "Hello, this is a test message!"
          }
        }]
      }
    }]
  }]
}
```

**Expected:**
1. Message disimpan ke database
2. Socket.IO emit `new_message` event
3. Frontend yang join room akan terima message real-time

---

## 🎯 Quick Start Checklist

- [ ] Install `socket.io-client`
- [ ] Initialize socket connection ke `http://localhost:8080`
- [ ] Listen to `connect`, `disconnect`, `connect_error` events
- [ ] Join room dengan `socket.emit('join_room', roomId)`
- [ ] Listen to `new_message` event
- [ ] Listen to `message_status_update` event
- [ ] Listen to `typing_indicator` event
- [ ] Render messages berdasarkan `content_type`
- [ ] Handle media messages dengan `gcs_url`
- [ ] Show notification untuk customer messages
- [ ] Leave room dengan `socket.emit('leave_room', roomId)` on unmount
- [ ] Test dengan simulate webhook via Postman

---

## 🆘 Troubleshooting

### Socket tidak connect
```javascript
// Check CORS settings
// Backend sudah set origin: '*' jadi should work
// Pastikan backend running di port 8080
```

### Messages tidak muncul real-time
```javascript
// Check apakah sudah join room
socket.emit('join_room', roomId);

// Check listener
socket.on('new_message', (data) => {
  console.log('Received:', data); // Should log when message arrives
});
```

### Media tidak bisa di-download
```javascript
// GCS URL public, should work
// Check network tab di browser
// Pastikan gcs_url tidak null/undefined
```

---

## 📞 Support

Jika ada pertanyaan atau issues:
1. Check console logs (frontend & backend)
2. Check network tab untuk Socket.IO connection
3. Test webhook dengan Postman
4. Contact backend team

---

## 🚀 Production Notes

Ketika deploy to production:

1. **Update Socket.IO URL:**
   ```javascript
   const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8080';
   const socket = io(SOCKET_URL);
   ```

2. **HTTPS/WSS:**
   ```javascript
   const socket = io('https://your-domain.com', {
     secure: true,
     transports: ['websocket', 'polling']
   });
   ```

3. **Error monitoring:**
   ```javascript
   socket.on('error', (error) => {
     Sentry.captureException(error); // or your error tracking
   });
   ```

---

**Happy coding! 🎉**

Jika ada pertanyaan, hubungi backend team.
