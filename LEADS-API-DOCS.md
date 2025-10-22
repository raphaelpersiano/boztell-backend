# Leads API Endpoints Documentation 📋

## 🗃️ **Database Schema**

Tabel `leads` di Supabase memiliki struktur:

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utm_id UUID REFERENCES utm_tracking(id),
  leads_status VARCHAR(50) DEFAULT 'cold',
  contact_status VARCHAR(50) DEFAULT 'not_contacted', 
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  outstanding BIGINT DEFAULT 0,
  loan_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 📡 **API Endpoints**

### 1. Get All Leads
```
GET /leads
```

**Query Parameters:**
- `leads_status` - Filter by lead status (cold, warm, hot, qualified, converted, lost)
- `contact_status` - Filter by contact status (not_contacted, contacted, interested, not_interested, follow_up)
- `loan_type` - Filter by loan type
- `utm_id` - Filter by UTM tracking ID
- `search` - Search in name or phone
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "utm_id": "uuid",
      "leads_status": "cold",
      "contact_status": "not_contacted",
      "name": "John Doe",
      "phone": "628123456789",
      "outstanding": 5000000,
      "loan_type": "personal_loan",
      "created_at": "2025-10-21T10:00:00Z",
      "updated_at": "2025-10-21T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### 2. Get Single Lead
```
GET /leads/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "utm_id": "uuid",
    "leads_status": "warm",
    "contact_status": "contacted",
    "name": "Jane Smith", 
    "phone": "628234567890",
    "outstanding": 3000000,
    "loan_type": "business_loan",
    "created_at": "2025-10-21T10:00:00Z",
    "updated_at": "2025-10-21T11:00:00Z"
  }
}
```

### 3. Create New Lead
```
POST /leads
```

**Request Body:**
```json
{
  "utm_id": "uuid", // optional
  "name": "New Lead Name", // required
  "phone": "628345678901", // required
  "outstanding": 2500000, // optional, default: 0
  "loan_type": "mortgage", // required
  "leads_status": "cold", // optional, default: 'cold'
  "contact_status": "not_contacted" // optional, default: 'not_contacted'
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "utm_id": null,
    "leads_status": "cold",
    "contact_status": "not_contacted",
    "name": "New Lead Name",
    "phone": "628345678901",
    "outstanding": 2500000,
    "loan_type": "mortgage",
    "created_at": "2025-10-21T12:00:00Z",
    "updated_at": "2025-10-21T12:00:00Z"
  }
}
```

### 4. Update Lead
```
PUT /leads/:id
```

**Request Body:** (All fields optional)
```json
{
  "utm_id": "uuid",
  "name": "Updated Name",
  "phone": "628456789012", 
  "outstanding": 4000000,
  "loan_type": "car_loan",
  "leads_status": "hot",
  "contact_status": "interested"
}
```

### 5. Delete Lead
```
DELETE /leads/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

### 6. Update Contact Status
```
POST /leads/:id/contact
```

**Request Body:**
```json
{
  "contact_status": "contacted" // required
}
```

**Valid Contact Status Values:**
- `not_contacted` - Belum dihubungi
- `contacted` - Sudah dihubungi
- `interested` - Tertarik
- `not_interested` - Tidak tertarik
- `follow_up` - Perlu follow up

### 7. Update Lead Status
```
PATCH /leads/:id/status
```

**Request Body:**
```json
{
  "leads_status": "warm" // required
}
```

**Valid Lead Status Values:**
- `cold` - Lead dingin
- `warm` - Lead hangat
- `hot` - Lead panas
- `qualified` - Lead berkualitas
- `converted` - Sudah konversi
- `lost` - Lead hilang

### 8. Get Lead by Phone
```
GET /leads/phone/:phone
```

**Example:**
```
GET /leads/phone/628123456789
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Lead by Phone",
    "phone": "628123456789",
    "leads_status": "warm",
    "contact_status": "contacted",
    // ... other fields
  }
}
```

### 9. Get Leads by UTM
```
GET /leads/utm/:utm_id
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "utm_id": "utm-uuid",
      "name": "Lead from Campaign",
      // ... other fields
    }
  ],
  "total": 5,
  "utm_id": "utm-uuid"
}
```

### 10. Bulk Update Leads
```
PATCH /leads/bulk
```

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2", "uuid3"],
  "updates": {
    "leads_status": "qualified",
    "contact_status": "contacted"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "leads_status": "qualified",
      "contact_status": "contacted",
      // ... updated data
    }
  ],
  "updated": 3,
  "requested": 3
}
```

### 11. Get Leads Statistics
```
GET /leads/stats/overview
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "status": "cold",
      "count": 50
    },
    {
      "status": "warm", 
      "count": 30
    },
    {
      "status": "hot",
      "count": 20
    }
  ]
}
```

## 🔄 **Migration from Old Schema**

### Field Mapping:
| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `nama_lengkap` | `name` | Renamed for consistency |
| `nomor_telpon` | `phone` | Simplified field name |
| `nominal_pinjaman` | `outstanding` | More descriptive name |
| `jenis_utang` | `loan_type` | English naming |
| `assigned_agent_id` | ❌ Removed | Agent assignment moved to room_participants |
| `notes` | ❌ Removed | Notes moved to messages |
| `metadata` | ❌ Removed | Specific fields preferred |
| ❌ | `utm_id` | New field for tracking |
| ❌ | `contact_status` | New field for contact tracking |

## 🎯 **Usage Examples**

### Create Lead from WhatsApp
```javascript
// When receiving WhatsApp message from new customer
const leadData = {
  name: customerName,
  phone: cleanPhone,
  loan_type: 'personal_loan',
  leads_status: 'cold',
  contact_status: 'contacted' // Already contacted via WhatsApp
};

const response = await fetch('/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(leadData)
});
```

### Update Lead After Conversation
```javascript
// After WhatsApp conversation
const updates = {
  leads_status: 'warm',
  contact_status: 'interested',
  outstanding: 5000000
};

await fetch(`/leads/${leadId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updates)
});
```

### Find Lead by Phone for Room Creation
```javascript
// When creating room, check if lead exists
const response = await fetch(`/leads/phone/${cleanPhone}`);
if (response.ok) {
  const { data: lead } = await response.json();
  // Use existing lead
} else {
  // Create new lead
}
```

## 🔗 **Integration with WhatsApp System**

### Room Creation Flow:
1. **Incoming WhatsApp message** from customer
2. **Check lead by phone**: `GET /leads/phone/:phone`
3. **If lead exists**: Use existing lead data for room
4. **If lead doesn't exist**: Create new lead
5. **Create room** with `leads_id` reference
6. **Update contact status** to 'contacted'

### Lead Status Automation:
- **New WhatsApp message**: `contact_status = 'contacted'`
- **Customer shows interest**: `leads_status = 'warm'`
- **Multiple interactions**: `leads_status = 'hot'`
- **Loan application**: `leads_status = 'qualified'`

## 🚀 **Next Steps**

1. **Update database functions** in `db.js` to match new schema
2. **Test all endpoints** with new field names
3. **Update frontend** to use new API structure
4. **Implement UTM tracking** integration
5. **Add lead analytics** dashboard

---

## 📝 **Notes**

- All endpoints maintain backward compatibility where possible
- Phone numbers are automatically cleaned (digits only)
- UTM tracking enables campaign performance analysis
- Contact status separate from lead status for better tracking
- Bulk operations support efficient lead management

Sistem leads sekarang fully integrated dengan WhatsApp room system! 🎯