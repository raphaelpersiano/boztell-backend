# Leads Kanban Board - API Documentation

## Overview
API endpoints untuk mendukung Kanban board lead funnel dengan fitur:
- **Role-based access control** (admin/supervisor = all leads, agent = assigned leads only)
- **Drag & drop** untuk update lead status
- **Real-time filtering** dan search

---

## 1. Get All Leads (with Role-based Access)

### Endpoint
```
GET /api/leads
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | ID user yang sedang login |
| `user_role` | string | Yes | Role user: `admin`, `supervisor`, atau `agent` |
| `leads_status` | string | No | Filter by status: `cold`, `warm`, `hot`, `paid`, `service`, `repayment`, `advocate` |
| `contact_status` | string | No | Filter by contact status: `uncontacted`, `contacted` |
| `loan_type` | string | No | Filter by loan type |
| `utm_id` | string | No | Filter by UTM tracking ID |
| `search` | string | No | Search by name or phone |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50) |

### Role-based Access Rules
- **Admin/Supervisor**: Mendapatkan SEMUA leads di database
- **Agent**: Hanya mendapatkan leads yang sudah di-assign ke mereka (via `room_participants`)

### Request Example
```javascript
// Agent request (assigned leads only)
fetch('/api/leads?user_id=agent-123&user_role=agent&page=1&limit=50')

// Admin request (all leads)
fetch('/api/leads?user_id=admin-456&user_role=admin&page=1&limit=50')

// With filters
fetch('/api/leads?user_id=agent-123&user_role=agent&leads_status=hot&search=john')
```

### Response Success (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-uuid-123",
      "utm_id": "utm-001",
      "name": "Ahmad Rizky Pratama",
      "phone": "6281234567890",
      "outstanding": 500000000,
      "loan_type": "KPR (Kredit Pemilikan Rumah)",
      "leads_status": "warm",
      "contact_status": "contacted",
      "created_at": "2025-10-25T10:00:00Z",
      "updated_at": "2025-10-25T15:30:00Z"
    },
    {
      "id": "lead-uuid-456",
      "utm_id": null,
      "name": "Budi Santoso",
      "phone": "6281234567892",
      "outstanding": 150000000,
      "loan_type": "Kredit Kendaraan",
      "leads_status": "hot",
      "contact_status": "contacted",
      "created_at": "2025-10-24T08:00:00Z",
      "updated_at": "2025-10-25T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "pages": 1
  },
  "meta": {
    "user_role": "agent",
    "access_type": "assigned_only"
  }
}
```

### Frontend Implementation Tips
```javascript
// Get current user from context/state
const { user_id, user_role } = useAuth();

// Fetch leads based on role
const fetchLeads = async (filters = {}) => {
  const queryParams = new URLSearchParams({
    user_id,
    user_role,
    page: 1,
    limit: 50,
    ...filters
  });
  
  const response = await fetch(`/api/leads?${queryParams}`);
  const result = await response.json();
  
  if (result.success) {
    // Group by leads_status for Kanban columns
    const groupedLeads = {
      cold: result.data.filter(l => l.leads_status === 'cold'),
      warm: result.data.filter(l => l.leads_status === 'warm'),
      hot: result.data.filter(l => l.leads_status === 'hot'),
      paid: result.data.filter(l => l.leads_status === 'paid'),
      // ... etc
    };
    
    return groupedLeads;
  }
};
```

---

## 2. Update Lead Status (Drag & Drop)

### Endpoint
```
PATCH /api/leads/:id/status
```

### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Lead ID (UUID) |

### Request Body
```json
{
  "leads_status": "hot",
  "user_id": "agent-123",
  "user_name": "John Agent"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `leads_status` | string | Yes | New status: `cold`, `warm`, `hot`, `paid`, `service`, `repayment`, `advocate` |
| `user_id` | string | No | User ID yang melakukan update (for logging) |
| `user_name` | string | No | User name yang melakukan update (for logging) |

### Valid Status Values
- `cold` - Cold leads (baru masuk, belum ada interaksi)
- `warm` - Warm leads (ada interaksi, mulai tertarik)
- `hot` - Hot leads (siap closing)
- `paid` - Paid (sudah bayar, loan approved)
- `service` - Service (dalam masa layanan)
- `repayment` - Repayment (dalam masa cicilan)
- `advocate` - Advocate (customer yang jadi promotor)

### Request Example
```javascript
// On drag & drop in Kanban
const handleDragEnd = async (leadId, newStatus) => {
  const response = await fetch(`/api/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leads_status: newStatus,
      user_id: currentUser.id,
      user_name: currentUser.name
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Update UI optimistically or refetch
    console.log('Lead status updated:', result.data);
  }
};
```

### Response Success (200)
```json
{
  "success": true,
  "data": {
    "id": "lead-uuid-123",
    "utm_id": "utm-001",
    "name": "Ahmad Rizky Pratama",
    "phone": "6281234567890",
    "outstanding": 500000000,
    "loan_type": "KPR (Kredit Pemilikan Rumah)",
    "leads_status": "hot",
    "contact_status": "contacted",
    "created_at": "2025-10-25T10:00:00Z",
    "updated_at": "2025-10-25T16:45:00Z"
  }
}
```

### Response Error (400) - Invalid Status
```json
{
  "success": false,
  "error": "Invalid leads_status: invalid_value",
  "valid_values": ["cold", "warm", "hot", "paid", "service", "repayment", "advocate"]
}
```

### Response Error (404) - Lead Not Found
```json
{
  "success": false,
  "error": "Lead not found"
}
```

---

## 3. Kanban Board Implementation Guide

### Frontend Library Recommendations
- **@dnd-kit/core** (React) - Modern drag & drop
- **react-beautiful-dnd** (React) - Popular choice
- **VueDraggable** (Vue) - For Vue.js

### Example Implementation (React + @dnd-kit)

```jsx
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

const LeadsKanban = () => {
  const { user_id, user_role } = useAuth();
  const [leads, setLeads] = useState({
    cold: [],
    warm: [],
    hot: [],
    paid: []
  });

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads();
  }, [user_id, user_role]);

  const fetchLeads = async () => {
    const response = await fetch(
      `/api/leads?user_id=${user_id}&user_role=${user_role}`
    );
    const result = await response.json();
    
    if (result.success) {
      // Group by status
      const grouped = {
        cold: result.data.filter(l => l.leads_status === 'cold'),
        warm: result.data.filter(l => l.leads_status === 'warm'),
        hot: result.data.filter(l => l.leads_status === 'hot'),
        paid: result.data.filter(l => l.leads_status === 'paid')
      };
      setLeads(grouped);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const leadId = active.id;
    const newStatus = over.id; // column ID = status name
    
    // Optimistic update
    const lead = findLeadById(leadId);
    const oldStatus = lead.leads_status;
    
    // Update UI immediately
    setLeads(prev => {
      const updated = { ...prev };
      updated[oldStatus] = updated[oldStatus].filter(l => l.id !== leadId);
      updated[newStatus] = [...updated[newStatus], { ...lead, leads_status: newStatus }];
      return updated;
    });
    
    // Update backend
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads_status: newStatus,
          user_id,
          user_name: currentUser.name
        })
      });
      
      if (!response.ok) {
        // Rollback on error
        setLeads(prev => {
          const rollback = { ...prev };
          rollback[newStatus] = rollback[newStatus].filter(l => l.id !== leadId);
          rollback[oldStatus] = [...rollback[oldStatus], lead];
          return rollback;
        });
        
        toast.error('Failed to update lead status');
      } else {
        toast.success(`Lead moved to ${newStatus}`);
      }
    } catch (error) {
      console.error('Update failed:', error);
      // Rollback on error
      fetchLeads(); // Refetch to ensure consistency
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {Object.entries(leads).map(([status, items]) => (
          <KanbanColumn
            key={status}
            status={status}
            leads={items}
            title={statusLabels[status]}
          />
        ))}
      </div>
    </DndContext>
  );
};
```

### Best Practices

1. **Optimistic UI Updates**
   - Update UI immediately on drag
   - Rollback if API fails
   - Show loading state during API call

2. **Error Handling**
   ```javascript
   try {
     await updateLeadStatus(leadId, newStatus);
   } catch (error) {
     // Rollback UI
     revertLeadPosition(leadId, oldStatus);
     // Show error message
     toast.error('Failed to update lead. Please try again.');
   }
   ```

3. **Real-time Updates (Optional)**
   - Use Socket.IO for multi-user collaboration
   - Listen to `lead:updated` event
   - Update UI when other agents move leads

4. **Access Control UI**
   ```javascript
   // Show different UI based on role
   const canEditLead = (lead) => {
     if (user_role === 'admin' || user_role === 'supervisor') {
       return true;
     }
     // Agent can only edit assigned leads
     return lead.is_assigned_to_me;
   };
   ```

---

## 4. Additional Endpoints

### Get Single Lead
```
GET /api/leads/:id
```

### Create New Lead
```
POST /api/leads
```
Body:
```json
{
  "name": "John Doe",
  "phone": "6281234567890",
  "loan_type": "KPR (Kredit Pemilikan Rumah)",
  "outstanding": 500000000,
  "leads_status": "cold",
  "contact_status": "uncontacted",
  "utm_id": "utm-001"
}
```

### Update Lead (Full)
```
PUT /api/leads/:id
```
Body: Same as POST, plus optional `room_id` and `title` for room update

### Delete Lead
```
DELETE /api/leads/:id
```

---

## 5. Data Flow Diagram

```
┌─────────────────┐
│   Frontend      │
│  (Kanban Board) │
└────────┬────────┘
         │
         │ 1. GET /api/leads?user_id=X&user_role=agent
         │
         ▼
┌─────────────────────────────┐
│  Backend API                │
│  /api/leads (GET)           │
└────────┬────────────────────┘
         │
         │ Check user_role
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────────────────┐
│ Admin │ │ Agent                │
│ All   │ │ Assigned Leads Only  │
│ Leads │ │ (via room_participants)│
└───────┘ └──────────────────────┘
    │         │
    │         │ Query room_participants → rooms → leads
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Database       │
│  - leads        │
│  - rooms        │
│  - room_participants │
└─────────────────┘
```

---

## 6. Testing Checklist

- [ ] Admin dapat melihat semua leads
- [ ] Supervisor dapat melihat semua leads
- [ ] Agent hanya melihat assigned leads
- [ ] Drag & drop update status berhasil
- [ ] Optimistic UI update bekerja
- [ ] Rollback on error bekerja
- [ ] Filter by status bekerja
- [ ] Search by name/phone bekerja
- [ ] Pagination bekerja
- [ ] Loading states ditampilkan
- [ ] Error messages jelas

---

## 7. Notes

- **Performance**: Endpoint sudah dioptimasi dengan pagination. Gunakan `limit=50` untuk performa terbaik.
- **Caching**: Pertimbangkan cache di frontend untuk mengurangi API calls.
- **Real-time**: Jika butuh real-time updates antar user, hubungi backend team untuk implementasi Socket.IO.
- **Mobile**: API mendukung mobile apps, pastikan handle `user_id` dan `user_role` dengan benar di mobile context.

---

## Support
Jika ada pertanyaan atau butuh endpoint tambahan, kontak backend team.
