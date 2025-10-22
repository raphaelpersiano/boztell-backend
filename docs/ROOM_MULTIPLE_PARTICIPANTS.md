# Room Participants - Multiple Users Per Room

## ✅ **CORRECTED UNDERSTANDING**

### 🔄 **1 Room → Many Participants**

**Database Schema:**
```sql
-- 1 room dapat memiliki BANYAK participants
room_participants (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),    -- Foreign key ke rooms
  user_id UUID REFERENCES users(id),    -- Foreign key ke users  
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: UNIQUE(room_id, user_id) - 1 user tidak bisa assign 2x ke room yang sama
```

**Relationship:**
- ✅ **1 Room** dapat memiliki **MANY Participants**
- ✅ **1 User** dapat di-assign ke **MANY Rooms**
- ✅ **Many-to-Many** relationship via `room_participants` junction table

---

## 👥 **User Name dari Table Users**

### ❌ **WRONG APPROACH (Before):**
```javascript
// ❌ agent_name sebagai input parameter
const { user_id, agent_name } = req.body;

// ❌ Menggunakan agent_name dari request
res.json({
  agent_name: agent_name || null  // ❌ Data tidak konsisten
});
```

### ✅ **CORRECT APPROACH (After):**
```javascript
// ✅ Hanya user_id sebagai input
const { user_id } = req.body;

// ✅ Get user info dari database
const userResult = await getUserById(user_id);
const targetUser = userResult.rows[0];

// ✅ Menggunakan data dari table users
res.json({
  user_name: targetUser.name,      // ✅ Dari table users
  user_email: targetUser.email,    // ✅ Dari table users  
  user_role: targetUser.role       // ✅ Dari table users
});
```

---

## 📊 **Multiple Participants Example**

### **Room dengan 3 Participants:**
```sql
-- Room: Customer Support Room
INSERT INTO room_participants VALUES
('participant-1', 'room-abc', 'agent-1', '2025-01-20T10:00:00Z'),
('participant-2', 'room-abc', 'agent-2', '2025-01-20T10:30:00Z'), 
('participant-3', 'room-abc', 'supervisor-1', '2025-01-20T11:00:00Z');
```

### **API Response - Room Details:**
```json
{
  "success": true,
  "data": {
    "room_id": "room-abc",
    "phone": "+628123456789",
    "title": "Customer Support",
    "participants": [
      {
        "user_id": "agent-1",
        "joined_at": "2025-01-20T10:00:00Z",
        "user_info": {
          "id": "agent-1",
          "name": "Agent Smith",      // ✅ Dari table users
          "email": "agent1@company.com", 
          "role": "agent"
        }
      },
      {
        "user_id": "agent-2", 
        "joined_at": "2025-01-20T10:30:00Z",
        "user_info": {
          "id": "agent-2",
          "name": "Agent Johnson",    // ✅ Dari table users
          "email": "agent2@company.com",
          "role": "agent"
        }
      },
      {
        "user_id": "supervisor-1",
        "joined_at": "2025-01-20T11:00:00Z", 
        "user_info": {
          "id": "supervisor-1",
          "name": "John Supervisor",  // ✅ Dari table users
          "email": "supervisor@company.com",
          "role": "supervisor"
        }
      }
    ]
  }
}
```

---

## 🔗 **CORRECTED API ENDPOINTS**

### **1. Assign User to Room**

**POST `/api/rooms/:roomId/assign`**

**Request Body (CORRECTED):**
```json
{
  "user_id": "uuid"
  // ❌ REMOVED: agent_name (tidak ada di table)
}
```

**Process Flow:**
1. ✅ Validate `user_id` exists in `users` table
2. ✅ Get user info: `name`, `email`, `role`
3. ✅ Check if user already assigned to room
4. ✅ Insert to `room_participants` table
5. ✅ Return response with user data from `users` table

**Response (CORRECTED):**
```json
{
  "success": true,
  "message": "User assigned to room successfully",
  "data": {
    "room_id": "room-uuid",
    "user_id": "user-uuid",
    "user_name": "Agent Smith",        // ✅ Dari users.name
    "user_email": "agent@company.com", // ✅ Dari users.email  
    "user_role": "agent",              // ✅ Dari users.role
    "joined_at": "2025-01-20T10:00:00Z",
    "assigned_by": "admin-uuid"
  }
}
```

### **2. Get Room Participants**

**GET `/api/rooms/:roomId/participants`**

**Response shows ALL participants:**
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
      "user_id": "agent-2", 
      "joined_at": "2025-01-20T10:30:00Z",
      "user_name": "Agent Johnson",    // ✅ Dari users.name
      "user_email": "agent2@company.com", 
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
  "room_id": "room-abc",
  "total_participants": 3              // ✅ Multiple participants
}
```

---

## 🏗️ **Database Query Pattern**

### **Join Pattern untuk Get Participants:**
```sql
SELECT 
  rp.user_id,
  rp.joined_at,
  u.name as user_name,        -- ✅ Nama dari users table
  u.email as user_email,      -- ✅ Email dari users table  
  u.role as user_role         -- ✅ Role dari users table
FROM room_participants rp
JOIN users u ON rp.user_id = u.id
WHERE rp.room_id = :roomId
ORDER BY rp.joined_at ASC;
```

### **Function `getRoomParticipantsWithUsers()`:**
```javascript
export async function getRoomParticipantsWithUsers(roomId) {
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      user_id,
      joined_at,
      users!inner (          -- ✅ JOIN dengan users table
        id,
        name,               -- ✅ Get name dari users
        email,              -- ✅ Get email dari users
        role                -- ✅ Get role dari users
      )
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
    
  return { rows: data || [], rowCount: data?.length || 0 };
}
```

---

## 🎯 **Use Cases - Multiple Participants**

### **1. Customer Support Team**
```
Room: "VIP Customer Issue"
Participants:
- Agent 1 (primary handler)
- Agent 2 (backup support)  
- Supervisor (oversight)
- Manager (escalation)
```

### **2. Sales Follow-up**
```
Room: "Enterprise Lead"
Participants:
- Sales Agent (lead owner)
- Sales Manager (closer)
- Technical Consultant (product expert)
```

### **3. Collaborative Support**
```
Room: "Complex Technical Issue" 
Participants:
- L1 Agent (initial contact)
- L2 Agent (technical specialist)
- L3 Engineer (expert support)
- Team Lead (coordination)
```

---

## ✅ **SUMMARY OF CORRECTIONS**

### **1. Multiple Participants Support:**
- ✅ 1 room dapat memiliki banyak participants
- ✅ Database schema mendukung many-to-many relationship
- ✅ API response menampilkan semua participants

### **2. User Name dari Database:**
- ✅ **REMOVED** `agent_name` dari request body
- ✅ **ADDED** validation user exists via `getUserById()`
- ✅ **GET** user info (`name`, `email`, `role`) dari table `users`
- ✅ **RETURN** data yang konsisten dengan database

### **3. Improved Data Consistency:**
- ✅ Semua user data berasal dari single source of truth (table `users`)
- ✅ Tidak ada redundant data entry
- ✅ Auto-sync ketika user data diupdate di table `users`

**Room assignment system sekarang 100% accurate dan mendukung multiple participants per room! 🎉**