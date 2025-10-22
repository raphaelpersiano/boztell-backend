# Room Assignment System Documentation

## Overview
Sistem room assignment memungkinkan admin/supervisor untuk menugaskan agent ke room tertentu. Agent hanya bisa mengakses room yang ditugaskan kepada mereka, sedangkan admin/supervisor bisa mengakses semua room.

## Database Schema

### Tables
```sql
-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leads_id UUID REFERENCES leads(id),
  phone VARCHAR(20) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room participants table (junction table)
CREATE TABLE room_participants (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'supervisor', 'agent'
  pin INTEGER UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### 1. Get All Rooms (Admin/Supervisor) or Assigned Rooms (Agent)
```
GET /api/rooms
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Admin/Supervisor):**
```json
{
  "success": true,
  "data": [
    {
      "room_id": "uuid",
      "room_phone": "+628123456789",
      "room_title": "Customer Support",
      "room_created_at": "2025-01-20T10:00:00Z",
      "room_updated_at": "2025-01-20T10:00:00Z",
      "leads_info": {
        "id": "uuid",
        "name": "John Doe",
        "phone": "+628123456789",
        "leads_status": "warm",
        "contact_status": "active",
        "outstanding": 5000000,
        "loan_type": "personal"
      },
      "participants": [
        {
          "user_id": "uuid",
          "joined_at": "2025-01-20T10:00:00Z",
          "user_info": {
            "id": "uuid",
            "name": "Agent Smith",
            "email": "agent@example.com",
            "role": "agent"
          }
        }
      ]
    }
  ]
}
```

### 2. Get Specific Room Details
```
GET /api/rooms/:roomId
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Access Control:**
- Admin/Supervisor: Can access any room
- Agent: Can only access assigned rooms

**Response:**
```json
{
  "success": true,
  "data": {
    "room_id": "uuid",
    "phone": "+628123456789",
    "title": "Customer Support",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z",
    "leads_info": {
      "id": "uuid",
      "name": "John Doe",
      "company": "PT Example",
      "status": "warm"
    },
    "participants": [
      {
        "user_id": "uuid",
        "joined_at": "2025-01-20T10:00:00Z",
        "user_info": {
          "id": "uuid",
          "name": "Agent Smith",
          "email": "agent@example.com",
          "role": "agent"
        }
      }
    ]
  }
}
```

### 3. Assign Agent to Room
```
POST /api/rooms/:roomId/assign
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Access Control:** Admin/Supervisor only

**Request Body:**
```json
{
  "agent_id": "uuid",
  "agent_name": "Agent Smith" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Agent assigned to room successfully",
  "data": {
    "room_id": "uuid",
    "agent_id": "uuid",
    "agent_name": "Agent Smith",
    "joined_at": "2025-01-20T10:00:00Z",
    "assigned_by": "uuid"
  }
}
```

**Error Responses:**
```json
// Agent already assigned
{
  "success": false,
  "error": "Agent already assigned to this room",
  "room_id": "uuid",
  "agent_id": "uuid"
}

// Room not found
{
  "success": false,
  "error": "Room not found"
}

// Access denied
{
  "success": false,
  "error": "Access denied. Only admin/supervisor can assign agents to rooms."
}
```

### 4. Unassign Agent from Room
```
DELETE /api/rooms/:roomId/assign/:agentId
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Access Control:** Admin/Supervisor only

**Response:**
```json
{
  "success": true,
  "message": "Agent unassigned from room successfully",
  "data": {
    "room_id": "uuid",
    "agent_id": "uuid",
    "unassigned_by": "uuid"
  }
}
```

### 5. Get Room Participants
```
GET /api/rooms/:roomId/participants
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Access Control:**
- Admin/Supervisor: Can access any room's participants
- Agent: Can only access assigned room's participants

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid",
      "joined_at": "2025-01-20T10:00:00Z",
      "user_name": "Agent Smith",
      "user_email": "agent@example.com",
      "user_role": "agent"
    }
  ],
  "room_id": "uuid",
  "total_participants": 1
}
```

## Authentication & Authorization

### JWT Token
Semua endpoint memerlukan JWT token yang valid di header Authorization:
```
Authorization: Bearer <jwt_token>
```

### Role-Based Access
- **Admin**: Full access ke semua rooms dan dapat assign/unassign agents
- **Supervisor**: Full access ke semua rooms dan dapat assign/unassign agents  
- **Agent**: Hanya bisa mengakses rooms yang ditugaskan kepada mereka

## Auto-Room Creation Flow

### Template Message Auto-Room Creation
Ketika mengirim template message ke nomor baru:

1. **Check existing room** by phone number
2. **If room not exists:**
   - Auto-create lead dengan data default
   - Auto-create room dengan leads_id
   - Room siap untuk di-assign ke agent

### ensureRoom Function
```javascript
// Auto-create lead and room if needed
const room = await ensureRoom(phone, title);

// Room structure:
{
  id: "uuid",
  leads_id: "uuid", // auto-created lead
  phone: "+628123456789",
  title: "WhatsApp Chat"
}
```

## Integration with Message System

### Message Flow dengan Room Assignment
1. **Template message** dikirim → Auto-create room jika belum ada
2. **Room assignment** oleh admin/supervisor ke agent
3. **Agent** dapat mengakses room dan membalas pesan
4. **FCM notifications** dikirim ke assigned agents

### Access Control di Message Endpoints
- Agent hanya bisa send/receive message di room yang ditugaskan
- Admin/supervisor bisa akses semua room messages

## Example Usage

### 1. Admin assigns agent to room
```bash
curl -X POST http://localhost:8080/api/rooms/room-uuid/assign \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agent-uuid", "agent_name": "John Doe"}'
```

### 2. Agent gets assigned rooms
```bash
curl -X GET http://localhost:8080/api/rooms \
  -H "Authorization: Bearer <agent-token>"
```

### 3. Agent accesses room messages
```bash
curl -X GET http://localhost:8080/api/messages/room/room-uuid \
  -H "Authorization: Bearer <agent-token>"
```

## Error Handling

### Common Error Codes
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Room/Agent not found
- `409`: Conflict (agent already assigned)
- `500`: Internal server error

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

## Best Practices

### 1. Room Assignment Strategy
- Assign agents berdasarkan skill/expertise
- Load balancing antar agents
- Monitor agent workload via participant count

### 2. Access Control
- Selalu validate user role sebelum assignment operations
- Log semua assignment activities untuk audit
- Implement rate limiting untuk assignment endpoints

### 3. Auto-Creation Flow
- ensureRoom() dipanggil setiap template message
- Auto-create lead dengan data minimal tapi valid
- Room title generated dari phone number atau custom

### 4. Performance
- Index room_participants table untuk query cepat
- Cache assigned rooms per agent
- Batch assignment operations jika possible

## Migration Notes

### From Leads Assignment to Room Assignment
- **Before**: Leads assigned directly to agents
- **After**: Rooms assigned to agents, rooms contain leads
- **Migration**: Create room_participants entries berdasarkan existing lead assignments

### Database Migration Script
```sql
-- Create room_participants from existing lead assignments
INSERT INTO room_participants (room_id, user_id, joined_at)
SELECT r.id, l.assigned_agent_id, r.created_at
FROM rooms r
JOIN leads l ON r.leads_id = l.id
WHERE l.assigned_agent_id IS NOT NULL;
```