# 🏢 Rooms API Endpoints - CORRECTED

## ✅ **FIXED ENDPOINT NAMING**

### **Before (INCORRECT):**
```
❌ /rooms/rooms              (double rooms)
❌ /rooms/rooms/:roomId      (double rooms)
❌ /api/rooms                (inconsistent)
```

### **After (CORRECT):**
```
✅ /rooms                    (clean)
✅ /rooms/:roomId            (clean)
✅ /rooms/:roomId/assign     (clean)
```

---

## 🔗 **COMPLETE API ENDPOINTS**

### **1. Get All Rooms**
```
GET /rooms
Authorization: Bearer <token>
```

**Access Control:**
- ✅ **Admin/Supervisor:** Get ALL rooms
- ✅ **Agent:** Get only ASSIGNED rooms

**Response:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "room_id": "uuid",
        "room_phone": "+628123456789",
        "room_title": "Customer Support",
        "room_created_at": "2025-01-20T10:00:00Z",
        "leads_info": { ... },
        "participants": [
          {
            "user_id": "agent-1",
            "joined_at": "2025-01-20T10:00:00Z",
            "user_name": "Agent Smith",
            "user_role": "agent"
          }
        ]
      }
    ],
    "total_count": 25,
    "user_role": "admin"
  }
}
```

### **2. Get Specific Room**
```
GET /rooms/:roomId
Authorization: Bearer <token>
```

**Access Control:**
- ✅ **Admin/Supervisor:** Access ANY room
- ✅ **Agent:** Access only ASSIGNED rooms

**Response:**
```json
{
  "success": true,
  "data": {
    "room_id": "room-uuid",
    "phone": "+628123456789",
    "title": "Customer Support",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T15:30:00Z",
    "leads_info": {
      "id": "lead-uuid",
      "utm_id": "campaign-001",
      "leads_status": "warm",
      "contact_status": "active",
      "name": "John Doe",
      "phone": "+628123456789",
      "outstanding": 15000000,
      "loan_type": "personal"
    },
    "participants": [
      {
        "user_id": "agent-1",
        "joined_at": "2025-01-20T10:00:00Z",
        "user_name": "Agent Smith",
        "user_role": "agent"
      }
    ]
  }
}
```

### **3. Assign User to Room**
```
POST /rooms/:roomId/assign
Authorization: Bearer <token>
Content-Type: application/json
```

**Access Control:**
- ✅ **Admin/Supervisor ONLY**

**Request Body:**
```json
{
  "user_id": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User assigned to room successfully",
  "data": {
    "room_id": "room-uuid",
    "user_id": "user-uuid",
    "user_name": "Agent Smith",         // ✅ Dari users table
    "user_email": "agent@company.com",  // ✅ Dari users table
    "user_role": "agent",               // ✅ Dari users table
    "joined_at": "2025-01-20T10:00:00Z",
    "assigned_by": "admin-uuid"
  }
}
```

### **4. Unassign User from Room**
```
DELETE /rooms/:roomId/assign/:userId
Authorization: Bearer <token>
```

**Access Control:**
- ✅ **Admin/Supervisor ONLY**

**Response:**
```json
{
  "success": true,
  "message": "User unassigned from room successfully",
  "data": {
    "room_id": "room-uuid",
    "user_id": "user-uuid",
    "unassigned_by": "admin-uuid"
  }
}
```

### **5. Remove Participant by ID**
```
DELETE /participants/:participantId
Authorization: Bearer <token>
```

**Access Control:**
- ✅ **Admin/Supervisor ONLY**

**Response:**
```json
{
  "success": true,
  "message": "Room participant removed successfully",
  "data": {
    "participant_id": "participant-uuid",
    "removed_by": "admin-uuid",
    "removed_participant": {
      "id": "participant-uuid",
      "room_id": "room-uuid",
      "user_id": "user-uuid",
      "joined_at": "2025-01-20T10:00:00Z"
    }
  }
}
```

### **6. Get Room Participants**
```
GET /rooms/:roomId/participants
Authorization: Bearer <token>
```

**Access Control:**
- ✅ **Admin/Supervisor:** Access ANY room participants
- ✅ **Agent:** Access only ASSIGNED rooms participants

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "agent-1",
      "joined_at": "2025-01-20T10:00:00Z",
      "user_name": "Agent Smith",      // ✅ Dari users.name
      "user_email": "agent1@company.com",
      "user_role": "agent"
    },
    {
      "user_id": "supervisor-1",
      "joined_at": "2025-01-20T11:00:00Z",
      "user_name": "John Supervisor",  // ✅ Dari users.name
      "user_email": "supervisor@company.com",
      "user_role": "supervisor"
    }
  ],
  "room_id": "room-uuid",
  "total_participants": 2
}
```

---

## 🛡️ **AUTHENTICATION & AUTHORIZATION**

### **Role-Based Access:**

**Admin/Supervisor:**
- ✅ View ALL rooms
- ✅ View ANY room details
- ✅ Assign users to rooms
- ✅ Unassign users from rooms
- ✅ Remove participants
- ✅ View ALL room participants

**Agent:**
- ✅ View only ASSIGNED rooms
- ✅ View details of ASSIGNED rooms only
- ❌ Cannot assign/unassign users
- ❌ Cannot remove participants
- ✅ View participants of ASSIGNED rooms only

### **Authentication Header:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Token Payload:**
```json
{
  "user": {
    "id": "user-uuid",
    "name": "Agent Smith",
    "email": "agent@company.com",
    "role": "agent"
  }
}
```

---

## 🔄 **ENDPOINT COMPARISON**

### **Before vs After:**

| **Before (WRONG)**           | **After (CORRECT)**              |
|------------------------------|----------------------------------|
| `/rooms/rooms`               | `/rooms`                         |
| `/rooms/rooms/:roomId`       | `/rooms/:roomId`                 |
| `/rooms/rooms/:roomId/assign`| `/rooms/:roomId/assign`          |
| `/api/rooms` (in docs)       | `/rooms` (consistent)            |

### **Mounting Point:**
```javascript
// index.js
app.use('/rooms', roomsRouter);  // ✅ Base path

// rooms.js  
router.get('/', ...)             // ✅ Results in /rooms
router.get('/:roomId', ...)      // ✅ Results in /rooms/:roomId
```

---

## 📝 **TESTING ENDPOINTS**

### **cURL Examples:**

**1. Get All Rooms:**
```bash
curl -X GET "http://localhost:3000/rooms" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**2. Get Specific Room:**
```bash
curl -X GET "http://localhost:3000/rooms/room-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**3. Assign User to Room:**
```bash
curl -X POST "http://localhost:3000/rooms/room-uuid/assign" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-uuid"}'
```

**4. Get Room Participants:**
```bash
curl -X GET "http://localhost:3000/rooms/room-uuid/participants" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ **SUMMARY OF FIXES**

### **1. Endpoint Naming:**
- ✅ **REMOVED** duplicate `/rooms` paths
- ✅ **CLEAN** endpoint structure
- ✅ **CONSISTENT** naming convention

### **2. Route Structure:**
- ✅ **Base mount:** `/rooms` in index.js
- ✅ **Route paths:** `/`, `/:roomId`, etc. in rooms.js
- ✅ **Final URLs:** `/rooms`, `/rooms/:roomId`, `/rooms/:roomId/assign`

### **3. Documentation:**
- ✅ **UPDATED** API endpoint references
- ✅ **CONSISTENT** with actual implementation
- ✅ **CLEAR** access control and authentication

**All rooms endpoints are now clean and consistent! 🎉**