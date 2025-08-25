# Google Cloud Storage Organization

## Simplified Room Structure

With our updated approach, **1 room chat = 1 phone number**, making the storage organization much cleaner and aligned with WhatsApp's natural behavior.

## Folder Structure

```
bucket-name/
├── media/
│   ├── 628123456789/           # Customer phone number (Indonesian)
│   │   ├── 2024-01-15/
│   │   │   ├── image_001.jpg
│   │   │   ├── voice_note_002.ogg
│   │   │   └── document_003.pdf
│   │   ├── 2024-01-16/
│   │   │   ├── video_004.mp4
│   │   │   └── image_005.png
│   │   └── 2024-01-17/
│   │       └── location_share_006.jpg
│   ├── 14155552222/            # Customer phone number (US)
│   │   ├── 2024-01-15/
│   │   │   └── document_001.pdf
│   │   └── 2024-01-16/
│   │       ├── image_002.jpg
│   │       └── audio_003.mp3
│   └── 447777123456/           # Customer phone number (UK)
│       └── 2024-01-15/
│           ├── image_001.webp
│           └── sticker_002.webp
├── uploads/
│   ├── 628123456789/           # Phone-based organization for uploads too
│   │   ├── 2024-01-15/
│   │   │   └── manual_upload_001.jpg
│   │   └── 2024-01-16/
│   │       └── bulk_upload_002.zip
│   └── 14155552222/
│       └── 2024-01-15/
│           └── profile_pic_001.png
└── exports/
    ├── 628123456789/
    │   └── chat_export_2024-01-15.json
    └── 14155552222/
        └── conversation_backup_2024-01-16.zip
```

## Benefits of Simplified Structure

### 1. **Intuitive Organization**
- Each phone number gets its own folder
- Matches WhatsApp's natural 1:1 chat concept
- Easy to find all media for a specific customer

### 2. **Clean API**
```javascript
// Get all media dates for a customer
GET /api/media/dates?phone=628123456789

// List media files for a specific date
GET /api/media/list?phone=628123456789&date=2024-01-15

// Get storage statistics for a customer
GET /api/media/stats?phone=628123456789
```

### 3. **Simplified Room Management**
```javascript
// Room ID is simply the customer phone number
const roomId = "628123456789";

// Socket room joining
socket.join(`room:${roomId}`);

// Message routing
io.to(`room:${roomId}`).emit('new_message', messageData);
```

## File Naming Convention

Files are automatically named with timestamps and original names:
- Format: `{timestamp}_{originalName}`
- Example: `1705123456789_family_photo.jpg`
- Ensures uniqueness and chronological ordering

## Phone Number Cleaning

Phone numbers are cleaned for folder naming:
- Remove all non-digit characters: `+62 812-3456-789` → `628123456789`
- Validate length (10-15 digits)
- Use cleaned number as folder name

## Implementation Examples

### Upload Media
```bash
curl -X POST http://localhost:3000/api/media/upload \
  -F "file=@photo.jpg" \
  -F "room_id=628123456789"
```

### List Customer Media
```bash
curl "http://localhost:3000/api/media/list?phone=628123456789&date=2024-01-15"
```

### Get Storage Stats
```bash
curl "http://localhost:3000/api/media/stats?phone=628123456789"
```

This simplified approach makes the backend much more intuitive and aligns perfectly with how WhatsApp actually works - each customer phone number corresponds to exactly one chat room.
