# Frontend Implementation Guide: WhatsApp Message Types

## 📖 Narasi & Konsep

Aplikasi ini mendukung **15 tipe pesan WhatsApp** yang berbeda. Frontend perlu menampilkan setiap tipe dengan UI yang sesuai, mirip dengan WhatsApp asli. Backend sudah mengirim semua tipe pesan melalui Socket.IO event `new_message` dengan struktur yang **konsisten**.

### Konsep Dasar

**Semua pesan memiliki struktur sama di level top:**
```typescript
interface Message {
  // ✅ ALWAYS PRESENT - Core fields
  id: string;                    // UUID message
  room_id: string;               // UUID room/chat
  user_id: string | null;        // null = customer, uuid = agent
  content_type: MessageType;     // Tipe pesan
  content_text: string;          // Text utama
  wa_message_id: string;         // WhatsApp message ID
  status: MessageStatus;         // received|sent|delivered|read|failed
  created_at: string;            // ISO timestamp
  
  // ✅ CONDITIONAL - Media fields (jika content_type === 'media')
  media_type?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  media_url?: string;            // Public URL dari GCS
  file_size?: number;            // Bytes
  mime_type?: string;            // MIME type
  original_filename?: string;    // Nama file asli
  thumbnail_url?: string;        // Thumbnail untuk image/video
  
  // ✅ OPTIONAL - Context fields
  reply_to_wa_message_id?: string | null;      // Reply ke message lain
  reaction_emoji?: string | null;              // Emoji reaction
  reaction_to_wa_message_id?: string | null;   // Reaction ke message mana
  metadata?: any;                              // Data tambahan specific per type
}
```

**Key Points:**
1. **Check `content_type` first** - ini menentukan UI component mana yang dipakai
2. **Check `user_id`** - null = customer (bubble kiri), ada value = agent (bubble kanan)
3. **Check `media_type`** jika `content_type === 'media'` - untuk render media yang benar
4. **Check `reply_to_wa_message_id`** - untuk tampilkan reply indicator
5. **Check `reaction_emoji`** - untuk tampilkan reaction badge

---

## 🎨 UI Component Strategy

### Component Structure (React/Next.js Example)

```tsx
// components/chat/MessageBubble.tsx
import { Message } from '@/types';

export const MessageBubble = ({ message }: { message: Message }) => {
  // 1. Determine message direction (customer or agent)
  const isAgent = message.user_id !== null;
  const alignRight = isAgent;
  
  // 2. Render different component based on content_type
  return (
    <div className={`message-bubble ${alignRight ? 'agent' : 'customer'}`}>
      {/* Reply indicator (if any) */}
      {message.reply_to_wa_message_id && (
        <ReplyIndicator messageId={message.reply_to_wa_message_id} />
      )}
      
      {/* Main content - switch based on type */}
      {renderMessageContent(message)}
      
      {/* Message metadata (timestamp, status) */}
      <MessageFooter 
        timestamp={message.created_at}
        status={message.status}
        isAgent={isAgent}
      />
      
      {/* Reactions (if any) */}
      {message.reaction_emoji && (
        <ReactionBadge emoji={message.reaction_emoji} />
      )}
    </div>
  );
};

const renderMessageContent = (message: Message) => {
  switch (message.content_type) {
    case 'text':
      return <TextMessage text={message.content_text} />;
    
    case 'media':
      return renderMediaMessage(message);
    
    case 'location':
      return <LocationMessage metadata={message.metadata} />;
    
    case 'contacts':
      return <ContactsMessage metadata={message.metadata} />;
    
    case 'reaction':
      return <ReactionMessage emoji={message.reaction_emoji!} />;
    
    case 'interactive':
      return <InteractiveMessage metadata={message.metadata} />;
    
    case 'button':
      return <ButtonMessage metadata={message.metadata} />;
    
    case 'order':
      return <OrderMessage metadata={message.metadata} />;
    
    case 'system':
      return <SystemMessage text={message.content_text} />;
    
    default:
      return <UnsupportedMessage />;
  }
};

const renderMediaMessage = (message: Message) => {
  switch (message.media_type) {
    case 'image':
      return <ImageMessage url={message.media_url!} caption={message.content_text} />;
    
    case 'video':
      return <VideoMessage url={message.media_url!} thumbnail={message.thumbnail_url} />;
    
    case 'audio':
      return <AudioMessage url={message.media_url!} />;
    
    case 'document':
      return <DocumentMessage 
        url={message.media_url!}
        filename={message.original_filename!}
        size={message.file_size}
      />;
    
    case 'sticker':
      return <StickerMessage url={message.media_url!} />;
    
    default:
      return <UnsupportedMedia />;
  }
};
```

---

## 📱 Implementation per Message Type

### 1. Text Messages 💬

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "text",
  "content_text": "Hello, how can I help you?",
  "user_id": null,
  "status": "received"
}
```

**Frontend component:**
```tsx
const TextMessage = ({ text }: { text: string }) => {
  // Support for links, mentions, formatting
  const formattedText = formatWhatsAppText(text); // *bold*, _italic_, ~strike~
  
  return (
    <div className="text-message">
      <p className="whitespace-pre-wrap">{formattedText}</p>
    </div>
  );
};

// Utility: Format WhatsApp markdown
const formatWhatsAppText = (text: string) => {
  return text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')  // *bold*
    .replace(/_(.*?)_/g, '<em>$1</em>')            // _italic_
    .replace(/~(.*?)~/g, '<del>$1</del>')          // ~strikethrough~
    .replace(/```(.*?)```/g, '<code>$1</code>');   // ```code```
};
```

**UI Guidelines:**
- ✅ Background: Light gray (customer), Blue (agent)
- ✅ Padding: 8-12px
- ✅ Border radius: 8px
- ✅ Max width: 65% of container
- ✅ Support text wrapping
- ✅ Linkify URLs automatically

---

### 2. Image Messages 🖼️

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "media",
  "media_type": "image",
  "media_url": "https://storage.googleapis.com/bucket/image.jpg",
  "thumbnail_url": "https://storage.googleapis.com/.../thumb.jpg",
  "content_text": "Check out this photo!",
  "file_size": 245678,
  "mime_type": "image/jpeg"
}
```

**Frontend component:**
```tsx
const ImageMessage = ({ url, caption }: { url: string; caption?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  return (
    <div className="image-message">
      {/* Image with lazy loading */}
      <div 
        className="image-container cursor-pointer rounded-lg overflow-hidden"
        onClick={() => setLightboxOpen(true)}
      >
        {isLoading && <ImageSkeleton />}
        <img 
          src={url}
          alt={caption || 'Image'}
          className="max-w-full h-auto"
          onLoad={() => setIsLoading(false)}
          loading="lazy"
        />
      </div>
      
      {/* Caption (if any) */}
      {caption && (
        <p className="mt-2 text-sm">{caption}</p>
      )}
      
      {/* Lightbox/Modal untuk full view */}
      {lightboxOpen && (
        <ImageLightbox 
          src={url} 
          alt={caption}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};
```

**UI Guidelines:**
- ✅ Max width: 300px
- ✅ Show thumbnail first, lazy load full image
- ✅ Click to open full screen lightbox
- ✅ Show loading spinner while downloading
- ✅ Caption below image (if exists)
- ✅ Rounded corners
- ✅ Download button on hover

---

### 3. Video Messages 🎥

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "media",
  "media_type": "video",
  "media_url": "https://storage.googleapis.com/bucket/video.mp4",
  "thumbnail_url": "https://storage.googleapis.com/.../thumb.jpg",
  "content_text": "Watch this!",
  "file_size": 5242880,
  "mime_type": "video/mp4"
}
```

**Frontend component:**
```tsx
const VideoMessage = ({ url, thumbnail }: { url: string; thumbnail?: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <div className="video-message">
      <div className="video-container relative rounded-lg overflow-hidden">
        {!isPlaying ? (
          // Thumbnail with play button
          <div className="relative cursor-pointer" onClick={() => setIsPlaying(true)}>
            <img src={thumbnail || '/video-placeholder.png'} alt="Video thumbnail" />
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
              <PlayIcon className="w-16 h-16 text-white" />
            </div>
          </div>
        ) : (
          // Video player
          <video 
            src={url}
            controls
            autoPlay
            className="w-full"
            onEnded={() => setIsPlaying(false)}
          >
            Your browser doesn't support video.
          </video>
        )}
      </div>
      
      {content_text && <p className="mt-2 text-sm">{content_text}</p>}
    </div>
  );
};
```

**UI Guidelines:**
- ✅ Show thumbnail with play icon overlay
- ✅ Click to play inline
- ✅ Native video controls
- ✅ Download option
- ✅ Max width: 300px

---

### 4. Audio Messages 🎵

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "media",
  "media_type": "audio",
  "media_url": "https://storage.googleapis.com/bucket/voice.ogg",
  "file_size": 102400,
  "mime_type": "audio/ogg"
}
```

**Frontend component:**
```tsx
const AudioMessage = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  return (
    <div className="audio-message flex items-center gap-3 bg-gray-100 rounded-full px-4 py-2">
      {/* Play/Pause button */}
      <button onClick={togglePlay} className="flex-shrink-0">
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      
      {/* Waveform or progress bar */}
      <div className="flex-1">
        <div className="h-8 flex items-center">
          {/* Simple progress bar */}
          <div className="w-full bg-gray-300 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Duration */}
      <span className="text-xs text-gray-500">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>
      
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
```

**UI Guidelines:**
- ✅ WhatsApp-style audio player
- ✅ Play/pause button
- ✅ Waveform visualization (optional)
- ✅ Progress bar
- ✅ Duration display
- ✅ Rounded pill shape
- ✅ Speed control (1x, 1.5x, 2x)

---

### 5. Document Messages 📄

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "media",
  "media_type": "document",
  "media_url": "https://storage.googleapis.com/bucket/report.pdf",
  "original_filename": "Monthly_Report_Oct_2025.pdf",
  "file_size": 1024000,
  "mime_type": "application/pdf"
}
```

**Frontend component:**
```tsx
const DocumentMessage = ({ 
  url, 
  filename, 
  size 
}: { 
  url: string; 
  filename: string; 
  size?: number;
}) => {
  const fileExtension = filename.split('.').pop()?.toUpperCase() || 'FILE';
  const fileIcon = getFileIcon(fileExtension);
  
  const handleDownload = () => {
    window.open(url, '_blank');
  };
  
  return (
    <div className="document-message border rounded-lg p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer" onClick={handleDownload}>
      {/* File icon */}
      <div className="file-icon bg-blue-100 rounded p-3">
        {fileIcon}
        <span className="text-xs font-bold text-blue-600">{fileExtension}</span>
      </div>
      
      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{filename}</p>
        {size && (
          <p className="text-xs text-gray-500">{formatFileSize(size)}</p>
        )}
      </div>
      
      {/* Download button */}
      <DownloadIcon className="flex-shrink-0 text-gray-400" />
    </div>
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (ext: string) => {
  // Return appropriate icon based on file type
  const icons = {
    'PDF': <FileTextIcon />,
    'DOC': <FileDocIcon />,
    'DOCX': <FileDocIcon />,
    'XLS': <FileSpreadsheetIcon />,
    'XLSX': <FileSpreadsheetIcon />,
    'PPT': <FilePresentationIcon />,
    'PPTX': <FilePresentationIcon />,
  };
  return icons[ext] || <FileIcon />;
};
```

**UI Guidelines:**
- ✅ File icon with extension badge
- ✅ Filename (truncate if too long)
- ✅ File size
- ✅ Download button/action
- ✅ Border + hover effect
- ✅ Click anywhere to download

---

### 6. Location Messages 📍

**Backend sends:**
```json
{
  "id": "uuid-123",
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

**Frontend component:**
```tsx
const LocationMessage = ({ metadata }: { metadata: any }) => {
  const { location } = metadata;
  const { latitude, longitude, name, address } = location;
  
  // Generate static map image URL (Google Maps or Mapbox)
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x200&markers=color:red|${latitude},${longitude}&key=YOUR_API_KEY`;
  
  const openInMaps = () => {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
  };
  
  return (
    <div className="location-message border rounded-lg overflow-hidden cursor-pointer" onClick={openInMaps}>
      {/* Static map preview */}
      <div className="map-preview">
        <img 
          src={staticMapUrl} 
          alt="Location map"
          className="w-full h-40 object-cover"
        />
      </div>
      
      {/* Location details */}
      <div className="p-3 bg-gray-50">
        <div className="flex items-start gap-2">
          <MapPinIcon className="flex-shrink-0 text-red-500 mt-1" />
          <div>
            {name && <p className="font-medium">{name}</p>}
            {address && <p className="text-sm text-gray-600">{address}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**UI Guidelines:**
- ✅ Static map preview image
- ✅ Location name (if available)
- ✅ Address (if available)
- ✅ Coordinates
- ✅ Click to open in Google Maps
- ✅ Pin icon

---

### 7. Contact Sharing 👤

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "contacts",
  "content_text": "Shared contacts: John Doe, Jane Smith",
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

**Frontend component:**
```tsx
const ContactsMessage = ({ metadata }: { metadata: any }) => {
  const { contacts } = metadata;
  
  return (
    <div className="contacts-message space-y-2">
      {contacts.map((contact: any, idx: number) => (
        <div key={idx} className="contact-card border rounded-lg p-3 flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar bg-gray-200 rounded-full w-12 h-12 flex items-center justify-center">
            <UserIcon className="text-gray-500" />
          </div>
          
          {/* Contact info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium">{contact.name?.formatted_name || 'Contact'}</p>
            {contact.phones?.[0] && (
              <p className="text-sm text-gray-600">{contact.phones[0].phone}</p>
            )}
            {contact.emails?.[0] && (
              <p className="text-xs text-gray-500">{contact.emails[0].email}</p>
            )}
          </div>
          
          {/* Action button */}
          <button className="btn-sm bg-blue-500 text-white px-3 py-1 rounded">
            Add
          </button>
        </div>
      ))}
    </div>
  );
};
```

**UI Guidelines:**
- ✅ Card per contact
- ✅ Avatar placeholder
- ✅ Name, phone, email
- ✅ "Add to contacts" button
- ✅ Multiple contacts stacked

---

### 8. Reactions ❤️

**Backend sends:**
```json
{
  "id": "uuid-123",
  "content_type": "reaction",
  "content_text": "Reacted ❤️ to message",
  "reaction_emoji": "❤️",
  "reaction_to_wa_message_id": "wamid.original-message"
}
```

**Frontend component:**
```tsx
// Reactions are usually displayed ON the original message, not as separate bubble

const MessageBubble = ({ message }: { message: Message }) => {
  // ... existing code ...
  
  return (
    <div className="message-bubble relative">
      {/* Main message content */}
      {renderMessageContent(message)}
      
      {/* Reaction badge - positioned at bottom-right of bubble */}
      {message.reaction_emoji && (
        <div className="absolute -bottom-2 -right-2 bg-white border border-gray-300 rounded-full px-2 py-1 shadow-sm">
          <span className="text-sm">{message.reaction_emoji}</span>
        </div>
      )}
    </div>
  );
};

// For listing who reacted (like WhatsApp)
const ReactionList = ({ messageId }: { messageId: string }) => {
  // Fetch all reactions to this message
  const reactions = useReactions(messageId);
  
  // Group by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return (
    <div className="reaction-list flex gap-2 mt-1">
      {Object.entries(groupedReactions).map(([emoji, count]) => (
        <div key={emoji} className="reaction-badge bg-gray-100 rounded-full px-2 py-1 text-sm">
          {emoji} {count > 1 && <span className="text-xs ml-1">{count}</span>}
        </div>
      ))}
    </div>
  );
};
```

**UI Guidelines:**
- ✅ Display reaction badge on original message
- ✅ Small circular badge with emoji
- ✅ Position: bottom-right of message bubble
- ✅ Shadow for depth
- ✅ Group multiple reactions

---

### 9. Interactive Messages (Buttons & Lists) 🔘

**Backend sends:**
```json
{
  "id": "uuid-123",
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

**Frontend component:**
```tsx
const InteractiveMessage = ({ metadata }: { metadata: any }) => {
  const { interactive } = metadata;
  
  if (interactive.button_reply) {
    return (
      <div className="interactive-message border-l-4 border-blue-500 bg-blue-50 rounded p-3">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="text-blue-500" />
          <span className="font-medium">{interactive.button_reply.title}</span>
        </div>
      </div>
    );
  }
  
  if (interactive.list_reply) {
    return (
      <div className="interactive-message border-l-4 border-green-500 bg-green-50 rounded p-3">
        <div className="flex items-center gap-2">
          <ListIcon className="text-green-500" />
          <span className="font-medium">{interactive.list_reply.title}</span>
        </div>
        {interactive.list_reply.description && (
          <p className="text-sm text-gray-600 mt-1">{interactive.list_reply.description}</p>
        )}
      </div>
    );
  }
  
  return null;
};
```

**UI Guidelines:**
- ✅ Colored left border (blue for button, green for list)
- ✅ Icon indicator
- ✅ Selected option title
- ✅ Light background color

---

## 🔄 Real-time Updates (Socket.IO Integration)

### Setup Socket.IO Client

```tsx
// lib/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = () => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected');
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
    });
  }
  
  return socket;
};

export const getSocket = () => socket;
```

### Listen for Messages

```tsx
// hooks/useRealtimeMessages.ts
import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { Message } from '@/types';

export const useRealtimeMessages = (roomId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      console.log('📩 New message received:', message);
      
      // Validate message has required fields
      if (!message.id) {
        console.error('❌ Received message without id:', message);
        return;
      }
      
      // Only add if belongs to current room
      if (message.room_id === roomId) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        
        // Scroll to bottom
        scrollToBottom();
        
        // Play notification sound (if not from current user)
        if (message.user_id !== currentUserId) {
          playNotificationSound();
        }
      }
    };
    
    socket.on('new_message', handleNewMessage);
    
    // Cleanup
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [roomId]);
  
  return messages;
};
```

### Complete Chat Component

```tsx
// components/ChatWindow.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { Message } from '@/types';

export const ChatWindow = ({ roomId }: { roomId: string }) => {
  const [historicalMessages, setHistoricalMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get real-time messages via Socket.IO
  const realtimeMessages = useRealtimeMessages(roomId);
  
  // Combine historical + real-time messages
  const allMessages = [...historicalMessages, ...realtimeMessages];
  
  // Fetch historical messages on mount
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/messages/room/${roomId}?limit=50&order=asc`);
        const data = await response.json();
        setHistoricalMessages(data.messages || []);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, [roomId]);
  
  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);
  
  if (isLoading) {
    return <ChatSkeleton />;
  }
  
  return (
    <div className="chat-window flex flex-col h-full">
      {/* Messages area */}
      <div className="messages-container flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <MessageInput roomId={roomId} />
    </div>
  );
};
```

---

## 📊 State Management

### Message Store (Zustand/Redux Example)

```tsx
// store/messagesStore.ts
import create from 'zustand';
import { Message } from '@/types';

interface MessagesState {
  messagesByRoom: Record<string, Message[]>;
  addMessage: (roomId: string, message: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  updateMessageStatus: (messageId: string, status: string) => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messagesByRoom: {},
  
  addMessage: (roomId, message) => set((state) => ({
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomId]: [...(state.messagesByRoom[roomId] || []), message]
    }
  })),
  
  setMessages: (roomId, messages) => set((state) => ({
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomId]: messages
    }
  })),
  
  updateMessageStatus: (messageId, status) => set((state) => {
    const updated = { ...state.messagesByRoom };
    Object.keys(updated).forEach(roomId => {
      updated[roomId] = updated[roomId].map(msg =>
        msg.id === messageId ? { ...msg, status } : msg
      );
    });
    return { messagesByRoom: updated };
  })
}));
```

---

## ✅ Checklist Implementation

### Phase 1: Basic Messages (Week 1)
- [ ] Setup Socket.IO client
- [ ] Implement `MessageBubble` component
- [ ] Implement `TextMessage` component
- [ ] Implement `ImageMessage` component
- [ ] Implement message list with scroll
- [ ] Fetch historical messages API
- [ ] Real-time message reception

### Phase 2: Media Messages (Week 2)
- [ ] Implement `VideoMessage` with player
- [ ] Implement `AudioMessage` with player
- [ ] Implement `DocumentMessage` with download
- [ ] Implement `StickerMessage`
- [ ] Image lightbox/modal
- [ ] Media upload progress indicator

### Phase 3: Special Messages (Week 3)
- [ ] Implement `LocationMessage` with map
- [ ] Implement `ContactsMessage`
- [ ] Implement `ReactionMessage` display
- [ ] Implement `InteractiveMessage` (buttons/lists)
- [ ] Reply indicator component
- [ ] Message metadata (timestamp, status)

### Phase 4: UX Enhancements (Week 4)
- [ ] Message status icons (sent ✓, delivered ✓✓, read 💙💙)
- [ ] Typing indicators
- [ ] Unread message counter
- [ ] Notification sounds
- [ ] Message search
- [ ] Infinite scroll pagination
- [ ] Error handling & retry logic

---

## 🎯 Key Takeaways

1. **Always check `content_type` first** - ini yang menentukan component mana yang render
2. **All messages have same structure** - `id`, `room_id`, `user_id`, `content_text` always present
3. **Media messages have extra fields** - `media_url`, `media_type`, `file_size`, dll
4. **Use Socket.IO for real-time** - `new_message` event untuk semua tipe
5. **Fetch history via REST API** - `/messages/room/:roomId` untuk load old messages
6. **Combine historical + real-time** - Merge array untuk full message list
7. **Handle edge cases** - Missing fields, network errors, duplicate messages

**Backend sudah siap 100%!** Frontend tinggal implement UI component sesuai design WhatsApp. Semua data sudah dikirim dengan lengkap dan konsisten. 🚀
