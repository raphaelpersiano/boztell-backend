# Get Leads by User ID Endpoint Documentation

## ✅ **NEW ENDPOINT CREATED**

### 🎯 **Endpoint Overview**

**GET `/api/leads/user/:user_id`** - Mendapatkan semua leads yang dapat diakses oleh user melalui room assignments

### 🔄 **Query Flow**

Endpoint ini mengikuti flow 3-step sesuai permintaan:

1. **Step 1**: Query `room_participants` table berdasarkan `user_id` → mendapatkan list `room_id`
2. **Step 2**: Query `rooms` table berdasarkan list `room_id` → mendapatkan list `leads_id`  
3. **Step 3**: Query `leads` table berdasarkan list `leads_id` → mendapatkan data leads lengkap

### 📊 **Database Schema Flow**

```sql
-- Step 1: Get rooms assigned to user
SELECT room_id FROM room_participants WHERE user_id = :user_id

-- Step 2: Get leads_id from assigned rooms  
SELECT leads_id FROM rooms WHERE id IN (room_ids) AND leads_id IS NOT NULL

-- Step 3: Get leads data
SELECT * FROM leads WHERE id IN (leads_ids) ORDER BY created_at DESC
```

---

## 🔗 **API Specification**

### **GET `/api/leads/user/:user_id`**

**Method:** `GET`

**URL:** `http://localhost:8080/api/leads/user/:user_id`

**Parameters:**
- `user_id` (required) - UUID of the user

**Headers:** None required

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-uuid",
      "utm_id": null,
      "leads_status": "warm", 
      "contact_status": "active",
      "name": "John Doe",
      "phone": "+628123456789",
      "outstanding": 5000000,
      "loan_type": "personal",
      "created_at": "2025-01-20T10:00:00Z",
      "updated_at": "2025-01-20T10:30:00Z"
    },
    {
      "id": "lead-uuid-2",
      "utm_id": "utm-uuid",
      "leads_status": "hot",
      "contact_status": "contacted", 
      "name": "Jane Smith",
      "phone": "+628987654321",
      "outstanding": 7500000,
      "loan_type": "business",
      "created_at": "2025-01-20T11:00:00Z",
      "updated_at": "2025-01-20T11:15:00Z"
    }
  ],
  "total": 2,
  "user_id": "user-uuid",
  "message": "Found 2 leads for user"
}
```

**Response Success - No Leads (200):**
```json
{
  "success": true,
  "data": [],
  "total": 0,
  "user_id": "user-uuid",
  "message": "No leads found for this user"
}
```

**Response Error (400) - Missing user_id:**
```json
{
  "success": false,
  "error": "user_id is required"
}
```

**Response Error (500) - Server Error:**
```json
{
  "success": false,
  "error": "Failed to get leads by user ID",
  "details": "Database connection error"
}
```

---

## 📝 **Usage Examples**

### 1. Get Leads for Agent
```bash
curl -X GET http://localhost:8080/api/leads/user/agent-uuid-123
```

### 2. Get Leads for Supervisor
```bash
curl -X GET http://localhost:8080/api/leads/user/supervisor-uuid-456
```

### 3. JavaScript Fetch
```javascript
const userId = 'user-uuid-789';
const response = await fetch(`/api/leads/user/${userId}`);
const result = await response.json();

if (result.success) {
  console.log(`Found ${result.total} leads for user`);
  result.data.forEach(lead => {
    console.log(`${lead.name} - ${lead.leads_status} - ${lead.phone}`);
  });
}
```

---

## 🔍 **Function Implementation**

### **Database Function: `getLeadsByUserId(userId)`**

Located in `src/db.js`:

```javascript
export async function getLeadsByUserId(userId) {
  // Step 1: Get room_ids for the user from room_participants
  const { data: roomParticipants } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId);
    
  if (!roomParticipants || roomParticipants.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  const roomIds = roomParticipants.map(rp => rp.room_id);
  
  // Step 2: Get leads_ids from rooms table based on room_ids
  const { data: rooms } = await supabase
    .from('rooms')
    .select('leads_id')
    .in('id', roomIds)
    .not('leads_id', 'is', null);
    
  if (!rooms || rooms.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  // Remove duplicates from leads_ids
  const leadsIds = [...new Set(rooms.map(room => room.leads_id))];
  
  // Step 3: Get leads data based on leads_ids
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .in('id', leadsIds)
    .order('created_at', { ascending: false });
    
  return { rows: leads || [], rowCount: leads?.length || 0 };
}
```

---

## 🚀 **Integration Points**

### **1. Room Assignment System**
- Endpoint terintegrasi dengan sistem room assignment
- User hanya bisa melihat leads dari room yang di-assign kepada mereka
- Admin/supervisor bisa melihat leads dari semua room

### **2. Role-Based Access**
```javascript
// Untuk mendapatkan leads berdasarkan role:
if (user.role === 'admin' || user.role === 'supervisor') {
  // Use: GET /api/leads (all leads)
} else if (user.role === 'agent') {
  // Use: GET /api/leads/user/:user_id (assigned leads only)
}
```

### **3. Message System Integration**
- Leads yang dikembalikan adalah leads yang memiliki room
- Room tersebut memiliki message history
- User bisa akses message dari leads yang assigned

---

## ⚡ **Performance Considerations**

### **Optimization Features**
1. **Duplicate Removal**: `leads_id` di-deduplicate untuk menghindari query redundant
2. **Null Filtering**: Hanya room dengan `leads_id` yang valid yang diproses
3. **Single Query per Step**: Menggunakan `IN` operator untuk batch processing
4. **Proper Indexing**: Membutuhkan index pada:
   - `room_participants(user_id)`
   - `rooms(id, leads_id)`
   - `leads(id)`

### **Recommended Indexes**
```sql
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_rooms_leads_id ON rooms(leads_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);
```

---

## 🧪 **Testing**

### **Test Scenarios**
1. ✅ User dengan room assignments → return leads
2. ✅ User tanpa room assignments → return empty array
3. ✅ Non-existent user_id → return empty array
4. ✅ Missing user_id parameter → return 400 error
5. ✅ Database error handling → return 500 error

### **Test Script**
```bash
# Run test
node test-leads-by-user.js
```

---

## 📋 **Use Cases**

### **1. Agent Dashboard**
Agent login → get assigned leads → display dalam dashboard

### **2. Lead Management**
Supervisor assign agent ke room → agent bisa akses lead via endpoint ini

### **3. Reporting**
Generate report leads per agent berdasarkan room assignments

### **4. Mobile App**
Agent mobile app fetch assigned leads untuk offline access

---

## 🔄 **Workflow Example**

```
1. Admin assigns Agent to Room A & Room B
   → room_participants: (room_a, agent_id), (room_b, agent_id)

2. Room A contains Lead 1, Room B contains Lead 2
   → rooms: (room_a, lead_1), (room_b, lead_2)

3. Agent calls GET /api/leads/user/agent_id
   → Returns: [Lead 1 data, Lead 2 data]

4. Agent can now see and work with both leads
```

---

## ✅ **Implementation Complete**

**Files Modified:**
1. `src/db.js` - Added `getLeadsByUserId()` function
2. `src/routes/leads.js` - Added GET `/user/:user_id` endpoint  
3. `test-leads-by-user.js` - Test script created
4. `docs/LEADS_BY_USER.md` - Documentation created

**Status:** ✅ **Ready for Production**

**Endpoint:** `GET /api/leads/user/:user_id` siap digunakan! 🚀