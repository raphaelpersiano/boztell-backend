# Template Message Auto-Creation Flow

## 🎯 Overview

Saat agent kirim template message ke customer baru (tanpa `room_id`), backend akan otomatis:

1. ✅ **Create Lead** (jika belum ada)
2. ✅ **Create Room** dengan `leads_id` dari lead yang dibuat
3. ✅ **Assign Agent** ke room (jika role = agent)
4. ✅ **Send Template** message ke WhatsApp

---

## 📊 Flow Diagram

```
┌─────────────────────────────────────────────┐
│ POST /messages/send-template                │
│ Body: {                                     │
│   to: "6287879565390",                      │
│   templateName: "campaign_1",               │
│   languageCode: "id",                       │
│   user_id: "agent-uuid",                    │
│   room_id: null  ← Customer baru            │
│ }                                           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
            ┌──────────────┐
            │ room_id ada? │
            └──────┬───────┘
                   │
           ┌───────┴────────┐
           │                │
          YES              NO
           │                │
           ▼                ▼
      Use existing    ┌─────────────────┐
      room_id         │ STEP 1:         │
           │          │ Check/Create    │
           │          │ Lead            │
           │          └────────┬────────┘
           │                   │
           │                   ▼
           │          ┌─────────────────┐
           │          │ Lead exists?    │
           │          └────────┬────────┘
           │                   │
           │          ┌────────┴────────┐
           │          │                 │
           │         YES               NO
           │          │                 │
           │          ▼                 ▼
           │    Use existing    Create new lead:
           │    leads_id        - name: "Customer {phone}"
           │          │          - phone: phone
           │          │          - outstanding: 0
           │          │          - loan_type: personal_loan
           │          │          - leads_status: cold
           │          │          - contact_status: not_contacted
           │          │                 │
           │          └────────┬────────┘
           │                   │
           │                   ▼
           │          ┌─────────────────┐
           │          │ STEP 2:         │
           │          │ Create Room     │
           │          │ with leads_id   │
           │          └────────┬────────┘
           │                   │
           └───────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ STEP 3:         │
            │ Get user info   │
            │ from user_id    │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ role = "agent"? │
            └────────┬────────┘
                     │
            ┌────────┴────────┐
            │                 │
           YES               NO
            │                 │
            ▼                 ▼
    ┌──────────────┐    Skip assignment
    │ Check if     │    (admin/supervisor)
    │ already      │          │
    │ assigned     │          │
    └──────┬───────┘          │
           │                  │
    ┌──────┴──────┐           │
    │             │           │
   YES           NO           │
    │             │           │
    ▼             ▼           │
   Skip    Insert to          │
           room_participants  │
           (auto-assign)      │
    │             │           │
    └──────┬──────┘           │
           │                  │
           └──────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ STEP 4:         │
            │ Send Template   │
            │ to WhatsApp     │
            └─────────────────┘
```

---

## 📝 Request Example

### **Scenario 1: Customer Baru (No room_id)**

```json
POST /messages/send-template

{
  "to": "6287879565390",
  "templateName": "campaign_1",
  "languageCode": "id",
  "user_id": "f99b87bd-e010-41f1-a566-f4d0778d1ed9",
  "room_id": null,
  "parameters": []
}
```

**Backend Flow:**
1. ✅ Check lead dengan phone `6287879565390`
   - **Not found** → Create new lead
2. ✅ Create room dengan `leads_id` dari lead baru
3. ✅ Get user info → role = `agent`
4. ✅ Auto-assign agent ke room (insert `room_participants`)
5. ✅ Send template message

**Database Changes:**

```sql
-- 1. INSERT INTO leads
INSERT INTO leads (id, name, phone, outstanding, loan_type, leads_status, contact_status, utm_id, created_at)
VALUES (
  'lead-uuid-123',
  'Customer 6287879565390',
  '6287879565390',
  0,
  'personal_loan',
  'cold',
  'not_contacted',
  NULL,
  '2025-11-05T10:00:00Z'
);

-- 2. INSERT INTO rooms
INSERT INTO rooms (id, leads_id, phone, title, created_at, updated_at)
VALUES (
  'room-uuid-456',
  'lead-uuid-123', -- ✅ leads_id from step 1
  '6287879565390',
  'Personal',
  '2025-11-05T10:00:01Z',
  '2025-11-05T10:00:01Z'
);

-- 3. INSERT INTO room_participants (auto-assign agent)
INSERT INTO room_participants (room_id, user_id, joined_at)
VALUES (
  'room-uuid-456',
  'f99b87bd-e010-41f1-a566-f4d0778d1ed9', -- agent_id
  '2025-11-05T10:00:02Z'
);

-- 4. INSERT INTO messages
INSERT INTO messages (id, room_id, user_id, content_type, content_text, wa_message_id, metadata, created_at)
VALUES (
  'msg-uuid-789',
  'room-uuid-456',
  'f99b87bd-e010-41f1-a566-f4d0778d1ed9',
  'template',
  'Template: campaign_1',
  'wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEkEyRDk0NzJGQ0I3MzNBRkUwMAA=',
  '{"direction":"outgoing","source":"api","type":"template","templateName":"campaign_1","languageCode":"id"}',
  '2025-11-05T10:00:03Z'
);
```

**Response:**

```json
{
  "success": true,
  "to": "6287879565390",
  "templateName": "campaign_1",
  "languageCode": "id",
  "parameters": [],
  "message_id": "msg-uuid-789",
  "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEkEyRDk0NzJGQ0I3MzNBRkUwMAA=",
  "database_saved": {
    "message_id": "msg-uuid-789",
    "whatsapp_message_id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEkEyRDk0NzJGQ0I3MzNBRkUwMAA=",
    "room_id": "room-uuid-456"
  },
  "result": {
    "messaging_product": "whatsapp",
    "contacts": [{ "input": "6287879565390", "wa_id": "6287879565390" }],
    "messages": [{
      "id": "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEkEyRDk0NzJGQ0I3MzNBRkUwMAA=",
      "message_status": "accepted"
    }]
  }
}
```

---

### **Scenario 2: Customer Existing (Lead Already Exists)**

```json
POST /messages/send-template

{
  "to": "6287879565390",
  "templateName": "follow_up",
  "languageCode": "id",
  "user_id": "agent-002",
  "room_id": null
}
```

**Backend Flow:**
1. ✅ Check lead dengan phone `6287879565390`
   - **Found** → Use existing `leads_id`
2. ✅ Create room dengan existing `leads_id`
3. ✅ Auto-assign agent
4. ✅ Send template

---

### **Scenario 3: Room Existing (With room_id)**

```json
POST /messages/send-template

{
  "to": "6287879565390",
  "templateName": "reminder",
  "languageCode": "id",
  "user_id": "agent-003",
  "room_id": "existing-room-uuid-999"
}
```

**Backend Flow:**
1. ⏭️ Skip lead creation (room already has leads_id)
2. ⏭️ Skip room creation (use existing)
3. ✅ Check agent assignment → Assign if not assigned
4. ✅ Send template

---

## 🔍 Log Output

```
📋 Using existing lead for template message
  phone: 6287879565390
  leadsId: lead-uuid-123
  leadName: Customer 6287879565390

🆕 Created new room for new customer (template message)
  room_id: room-uuid-456
  leads_id: lead-uuid-123
  to: 6287879565390
  templateName: campaign_1

✅ Auto-assigned agent to room for template message
  room_id: room-uuid-456
  user_id: f99b87bd-e010-41f1-a566-f4d0778d1ed9
  user_name: Agent Budi
  user_role: agent
  action: auto_assign_agent_to_room

✅ Template message sent successfully
  to: 6287879565390
  templateName: campaign_1
  parameters: 0
  messageId: msg-uuid-789
  waMessageId: wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEkEyRDk0NzJGQ0I3MzNBRkUwMAA=
```

---

## 🗄️ Database Schema

### **Table: leads**
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  outstanding BIGINT DEFAULT 0,
  loan_type TEXT,
  leads_status TEXT DEFAULT 'cold',
  contact_status TEXT DEFAULT 'not_contacted',
  utm_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Table: rooms**
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leads_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL UNIQUE,
  title TEXT DEFAULT 'Personal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Table: room_participants**
```sql
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);
```

---

## ⚙️ Configuration

### **Lead Default Values**

When creating new lead automatically:

| Field | Value | Description |
|-------|-------|-------------|
| `name` | `Customer {phone}` | Auto-generated from phone |
| `phone` | From request | Customer phone number |
| `outstanding` | `0` | No outstanding debt initially |
| `loan_type` | `personal_loan` | Default loan type |
| `leads_status` | `cold` | Initial status |
| `contact_status` | `not_contacted` | Will update when customer replies |
| `utm_id` | `null` | No UTM tracking initially |

---

## 🛡️ Error Handling

### **1. Lead Creation Fails**
```
⚠️ Failed to create lead, proceeding without leads_id
```
- Room still created (without `leads_id`)
- Template still sent
- **Non-critical error**

### **2. Room Creation Fails**
```
❌ Failed to ensure room exists
```
- Template NOT sent
- **Critical error** - return 500

### **3. Auto-assign Fails**
```
⚠️ Failed to auto-assign agent to room (non-critical error)
```
- Room created
- Template still sent
- **Non-critical error**

### **4. WhatsApp Send Fails**
```
❌ WhatsApp send failed
```
- Lead created ✅
- Room created ✅
- Agent assigned ✅
- Template NOT sent ❌
- **Critical error** - return 500

---

## 🎯 Use Cases

### **Use Case 1: Marketing Campaign**

Agent mass-send template ke 1000 nomor baru:

```javascript
const newCustomers = ['6281111111111', '6282222222222', ...];

for (const phone of newCustomers) {
  await fetch('/messages/send-template', {
    method: 'POST',
    body: JSON.stringify({
      to: phone,
      templateName: 'campaign_1',
      languageCode: 'id',
      user_id: 'agent-123', // Same agent for all
      room_id: null // Will auto-create lead + room
    })
  });
}
```

**Result:**
- ✅ 1000 new leads created
- ✅ 1000 new rooms created (with `leads_id`)
- ✅ All rooms assigned to `agent-123`
- ✅ 1000 template messages sent

---

### **Use Case 2: Follow-up Existing Customer**

Customer sudah ada di system (lead exists), tapi belum ada room:

```json
{
  "to": "6287879565390",
  "templateName": "follow_up",
  "languageCode": "id",
  "user_id": "agent-456",
  "room_id": null
}
```

**Result:**
- ⏭️ Skip lead creation (already exists)
- ✅ Create room with existing `leads_id`
- ✅ Assign agent to room
- ✅ Send template

---

## 📊 Summary

| Step | Action | Table | Required | Auto-Fallback |
|------|--------|-------|----------|---------------|
| 1 | Check/Create Lead | `leads` | ❌ No | Continue without leads_id |
| 2 | Create Room | `rooms` | ✅ Yes | Fail request if fails |
| 3 | Assign Agent | `room_participants` | ❌ No | Continue if fails |
| 4 | Send Template | WhatsApp API | ✅ Yes | Fail request if fails |

**Critical Path:** Room creation + WhatsApp send
**Non-Critical:** Lead creation + Agent assignment

---

## ✅ Testing

### **Test 1: New Customer**
```bash
curl -X POST https://backend.com/messages/send-template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "6281234567890",
    "templateName": "campaign_1",
    "languageCode": "id",
    "user_id": "agent-uuid",
    "room_id": null
  }'
```

**Verify:**
```sql
-- Check lead created
SELECT * FROM leads WHERE phone = '6281234567890';

-- Check room created with leads_id
SELECT r.*, l.name as lead_name 
FROM rooms r 
JOIN leads l ON r.leads_id = l.id 
WHERE r.phone = '6281234567890';

-- Check agent assigned
SELECT * FROM room_participants 
WHERE room_id = (SELECT id FROM rooms WHERE phone = '6281234567890');
```

---

**Done!** 🚀 Backend sekarang otomatis create **Lead → Room → Assign Agent → Send Template** dalam satu flow!
