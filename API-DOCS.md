# API Documentation - Boztell Backend

## 🔐 Authentication

Semua protected endpoints memerlukan Bearer token di header:
```
Authorization: Bearer <your-jwt-token>
```

## 📋 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error code",
  "message": "Detailed error message"
}
```

## 🏠 Rooms API

### Get Rooms by User Role
```http
GET /rooms
Authorization: Bearer <token>
```

**Response (Admin/Supervisor):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "628123456789",
      "title": "John Doe Customer",
      "leads_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "last_message": {
        "content_text": "Hello, I need help",
        "created_at": "2024-01-15T11:30:00Z",
        "user_id": null
      }
    }
  ]
}
```

**Response (Agent):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "628123456789",
      "title": "Assigned Customer",
      "leads_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2024-01-15T10:30:00Z",
      "participant_role": "agent"
    }
  ]
}
```

### Get Room Messages
```http
GET /rooms/:roomId/messages?limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "room": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "628123456789",
      "title": "John Doe Customer"
    },
    "messages": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "room_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": null,
        "content_type": "text",
        "content_text": "Hello, I need help with my account",
        "wa_message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgS...",
        "created_at": "2024-01-15T11:30:00Z",
        "sender_name": "Customer",
        "sender_type": "customer"
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "room_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "990e8400-e29b-41d4-a716-446655440004",
        "content_type": "text",
        "content_text": "Hi! How can I help you today?",
        "wa_message_id": null,
        "created_at": "2024-01-15T11:32:00Z",
        "sender_name": "Agent John",
        "sender_type": "agent"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}
```

### Create New Room
```http
POST /rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "628234567890",
  "title": "Jane Smith Customer",
  "leads_id": "660e8400-e29b-41d4-a716-446655440005"
}
```

## 💬 Messages API

### Send Text Message
```http
POST /messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "message": "Thank you for contacting us!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message_id": "770e8400-e29b-41d4-a716-446655440006",
    "wa_message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgS...",
    "status": "sent",
    "phone": "628123456789"
  }
}
```

### Send Template Message
```http
POST /messages/send-template
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "template_name": "welcome_message",
  "language": "id",
  "parameters": [
    {
      "type": "text",
      "text": "John Doe"
    }
  ]
}
```

### Send Media Image
```http
POST /messages/send-media-image
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "image_url": "https://example.com/image.jpg",
  "caption": "Product catalog image"
}
```

### Send Document
```http
POST /messages/send-media-document
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "document_url": "https://example.com/manual.pdf",
  "filename": "Product_Manual.pdf",
  "caption": "Product manual for your reference"
}
```

### Send Location
```http
POST /messages/send-location
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "name": "Office Location",
  "address": "Jakarta, Indonesia"
}
```

### Send Interactive Button
```http
POST /messages/send-interactive-button
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "header_text": "Choose Option",
  "body_text": "How would you like to proceed?",
  "footer_text": "Select one option",
  "buttons": [
    {
      "type": "reply",
      "reply": {
        "id": "option_1",
        "title": "Get Support"
      }
    },
    {
      "type": "reply",
      "reply": {
        "id": "option_2",
        "title": "Check Status"
      }
    }
  ]
}
```

### Send Interactive List
```http
POST /messages/send-interactive-list
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "628123456789",
  "header_text": "Our Services",
  "body_text": "Please select a service category:",
  "footer_text": "We're here to help",
  "button_text": "View Services",
  "sections": [
    {
      "title": "Support Services",
      "rows": [
        {
          "id": "tech_support",
          "title": "Technical Support",
          "description": "Get help with technical issues"
        },
        {
          "id": "billing_support",
          "title": "Billing Support", 
          "description": "Questions about your bill"
        }
      ]
    }
  ]
}
```

## 🔗 Webhook API

### Webhook Verification (Setup)
```http
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<your-verify-token>&hub.challenge=<challenge>
```

**Response:** Returns the challenge value for successful verification.

### Webhook Message Receiver
```http
POST /webhook/whatsapp
Content-Type: application/json
X-Hub-Signature-256: sha256=<signature>

{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550559999",
              "phone_number_id": "12345678901234567"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Customer Name"
                },
                "wa_id": "628123456789"
              }
            ],
            "messages": [
              {
                "from": "628123456789",
                "id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgS...",
                "timestamp": "1729688400",
                "text": {
                  "body": "Hello, I need help"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "type": "text_message",
      "room_id": "550e8400-e29b-41d4-a716-446655440000",
      "message_id": "770e8400-e29b-41d4-a716-446655440007",
      "wa_message_id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgS...",
      "phone": "628123456789"
    }
  ]
}
```

## 🔐 Authentication API

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "agent@company.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "email": "agent@company.com",
      "full_name": "John Agent",
      "role": "agent",
      "status": "active"
    }
  }
}
```

### Get Profile
```http
GET /auth/profile
Authorization: Bearer <token>
```

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Validation Error - Invalid data format |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## 🚨 Security Requirements

### User ID Validation
**CRITICAL:** Semua outgoing message endpoints WAJIB memiliki `user_id` parameter. Tanpa user_id, request akan ditolak dengan error 400.

```json
{
  "success": false,
  "error": "MISSING_USER_ID",
  "message": "user_id is required for sending messages"
}
```

### Rate Limiting
- 100 requests per minute per user untuk message endpoints
- 1000 requests per minute untuk webhook endpoint
- 10 requests per minute untuk authentication endpoints

### Webhook Security
- Verify X-Hub-Signature-256 header
- Validate payload structure
- Check messaging_product = "whatsapp"

## 📝 Message Types Support

### Incoming (Customer → System)
- ✅ Text messages
- ✅ Image with caption
- ✅ Document with caption
- ✅ Audio messages
- ✅ Video messages
- ✅ Location sharing
- ✅ Contact sharing
- ✅ Interactive replies (button clicks)
- ✅ Interactive list selections

### Outgoing (System → Customer)
- ✅ Text messages
- ✅ Template messages with parameters
- ✅ Images with caption
- ✅ Documents with filename
- ✅ Audio files
- ✅ Video files
- ✅ Stickers
- ✅ Location coordinates
- ✅ Contact cards
- ✅ Quick reply buttons
- ✅ Interactive button menus
- ✅ Interactive list menus

## 🔄 Message Status Tracking

### Status Values
- `sent` - Message sent to WhatsApp
- `delivered` - Message delivered to recipient
- `read` - Message read by recipient
- `failed` - Message failed to send

### Status Updates via Webhook
```json
{
  "statuses": [
    {
      "id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgS...",
      "status": "delivered",
      "timestamp": "1729688500",
      "recipient_id": "628123456789"
    }
  ]
}
```

## 📱 Frontend Integration Notes

### Real-time Updates
- Implement WebSocket connection untuk real-time message updates
- Listen untuk room message events
- Update UI saat ada incoming webhook messages

### Message Attribution
- Messages dengan `user_id = null` adalah customer messages
- Messages dengan `user_id = UUID` adalah agent/admin messages  
- Display customer messages dengan styling berbeda

### Role-based UI
- Admin/Supervisor: Show all rooms
- Agent: Show only assigned rooms
- Hide/show features berdasarkan user role

---

**Note:** API ini menggunakan WhatsApp Business API v18.0. Pastikan semua endpoints tested sebelum production deployment.