# 📚 Frontend API Integration Guide

**Target:** Next.js Frontend Integration  
**Backend:** Boztell Backend v2.0.0  
**Base URL:** `http://localhost:8080` (development)

---

## 🏢 **ROOMS API ENDPOINTS**

### **Authentication Required**
All rooms endpoints require JWT authentication:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### **1. Get All Rooms**
```
GET /rooms
```

**Frontend Usage:**
```javascript
const getRooms = async (token) => {
  const response = await fetch('/rooms', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface RoomsResponse {
  success: boolean;
  data: {
    rooms: Room[];
    total_count: number;
    user_role: 'admin' | 'supervisor' | 'agent';
  };
}

interface Room {
  room_id: string;
  room_phone: string;
  room_title: string;
  room_created_at: string; // ISO date
  room_updated_at: string; // ISO date
  leads_info?: LeadInfo;
  participants: Participant[];
}

interface LeadInfo {
  id: string;
  utm_id?: string;
  leads_status: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';
  contact_status: 'uncontacted' | 'contacted';
  name: string;
  phone: string;
  outstanding: number;
  loan_type: string;
}

interface Participant {
  user_id: string;
  joined_at: string; // ISO date
  user_name: string;
  user_role: 'admin' | 'supervisor' | 'agent';
}
```

**Role-Based Access:**
- **Admin/Supervisor:** See ALL rooms
- **Agent:** See only ASSIGNED rooms

---

### **2. Get Specific Room**
```
GET /rooms/:roomId
```

**Frontend Usage:**
```javascript
const getRoomById = async (roomId, token) => {
  const response = await fetch(`/rooms/${roomId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface RoomDetailResponse {
  success: boolean;
  data: {
    room_id: string;
    phone: string;
    title: string;
    created_at: string;
    updated_at: string;
    leads_info?: LeadInfo;
    participants: Participant[];
  };
}
```

**Error Cases:**
- `403`: Access denied (agent not assigned to room)
- `404`: Room not found

---

### **3. Assign User to Room**
```
POST /rooms/:roomId/assign
```

**Access:** Admin/Supervisor ONLY

**Request Body:**
```typescript
interface AssignUserRequest {
  user_id: string; // UUID of user to assign
}
```

**Frontend Usage:**
```javascript
const assignUserToRoom = async (roomId, userId, token) => {
  const response = await fetch(`/rooms/${roomId}/assign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId
    })
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface AssignUserResponse {
  success: boolean;
  message: string;
  data: {
    room_id: string;
    user_id: string;
    user_name: string;    // From users table
    user_email: string;   // From users table
    user_role: string;    // From users table
    joined_at: string;    // ISO date
    assigned_by: string;  // Admin/supervisor ID
  };
}
```

**Error Cases:**
- `400`: Missing user_id
- `403`: Access denied (not admin/supervisor)
- `404`: Room or user not found
- `409`: User already assigned

---

### **4. Unassign User from Room**
```
DELETE /rooms/:roomId/assign/:userId
```

**Access:** Admin/Supervisor ONLY

**Frontend Usage:**
```javascript
const unassignUserFromRoom = async (roomId, userId, token) => {
  const response = await fetch(`/rooms/${roomId}/assign/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface UnassignUserResponse {
  success: boolean;
  message: string;
  data: {
    room_id: string;
    user_id: string;
    unassigned_by: string;
  };
}
```

---

### **5. Remove Participant by ID**
```
DELETE /participants/:participantId
```

**Access:** Admin/Supervisor ONLY

**Frontend Usage:**
```javascript
const removeParticipant = async (participantId, token) => {
  const response = await fetch(`/participants/${participantId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

---

### **6. Get Room Participants**
```
GET /rooms/:roomId/participants
```

**Frontend Usage:**
```javascript
const getRoomParticipants = async (roomId, token) => {
  const response = await fetch(`/rooms/${roomId}/participants`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface ParticipantsResponse {
  success: boolean;
  data: Participant[];
  room_id: string;
  total_participants: number;
}
```

---

## 👥 **LEADS API ENDPOINTS**

### **No Authentication Required**
Leads endpoints don't require authentication (public API).

### **1. Get All Leads with Filtering**
```
GET /leads
```

**Query Parameters:**
```typescript
interface LeadsQuery {
  leads_status?: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';
  contact_status?: 'uncontacted' | 'contacted';
  loan_type?: string;
  utm_id?: string;
  search?: string;     // Search in name/phone
  page?: number;       // Default: 1
  limit?: number;      // Default: 50
}
```

**Frontend Usage:**
```javascript
const getLeads = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.append(key, value.toString());
  });
  
  const response = await fetch(`/leads?${queryParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};

// Usage examples:
const allLeads = await getLeads();
const warmLeads = await getLeads({ leads_status: 'warm' });
const searchResults = await getLeads({ search: 'John', page: 2 });
```

**Response Structure:**
```typescript
interface LeadsResponse {
  success: boolean;
  data: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface Lead {
  id: string;
  utm_id?: string;
  name: string;
  phone: string;
  outstanding: number;
  loan_type: string;
  leads_status: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';
  contact_status: 'uncontacted' | 'contacted';
  created_at: string;  // ISO date
  updated_at: string;  // ISO date
}
```

---

### **2. Get Single Lead**
```
GET /leads/:id
```

**Frontend Usage:**
```javascript
const getLeadById = async (leadId) => {
  const response = await fetch(`/leads/${leadId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface LeadResponse {
  success: boolean;
  data: Lead;
}
```

**Error Cases:**
- `404`: Lead not found

---

### **3. Create New Lead**
```
POST /leads
```

**Request Body:**
```typescript
interface CreateLeadRequest {
  utm_id?: string;
  name: string;          // Required
  phone: string;         // Required
  outstanding?: number;  // Default: 0
  loan_type: string;     // Required
  leads_status?: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate'; // Default: 'cold'
  contact_status?: 'uncontacted' | 'contacted'; // Default: 'uncontacted'
}
```

**Frontend Usage:**
```javascript
const createLead = async (leadData) => {
  const response = await fetch('/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(leadData)
  });
  return await response.json();
};

// Usage example:
const newLead = await createLead({
  name: 'John Doe',
  phone: '+628123456789',
  loan_type: 'personal',
  outstanding: 15000000,
  utm_id: 'campaign-001'
});
```

**Response Structure:**
```typescript
interface CreateLeadResponse {
  success: boolean;
  data: Lead;
}
```

**Error Cases:**
- `400`: Missing required fields (name, phone, loan_type)

---

### **4. Update Lead**
```
PUT /leads/:id
```

**Request Body:**
```typescript
interface UpdateLeadRequest {
  utm_id?: string;
  name?: string;
  phone?: string;
  outstanding?: number;
  loan_type?: string;
  leads_status?: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';
  contact_status?: 'uncontacted' | 'contacted';
}
```

**Frontend Usage:**
```javascript
const updateLead = async (leadId, updates) => {
  const response = await fetch(`/leads/${leadId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  return await response.json();
};

// Usage example:
const updated = await updateLead('lead-123', {
  leads_status: 'warm',
  outstanding: 20000000
});
```

**Response Structure:**
```typescript
interface UpdateLeadResponse {
  success: boolean;
  data: Lead;
}
```

**Error Cases:**
- `404`: Lead not found

---

### **5. Delete Lead**
```
DELETE /leads/:id
```

**Frontend Usage:**
```javascript
const deleteLead = async (leadId) => {
  const response = await fetch(`/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface DeleteLeadResponse {
  success: boolean;
  message: string;
}
```

---

### **6. Update Lead Contact Status**
```
PATCH /leads/:id/contact-status
```

**Request Body:**
```typescript
interface UpdateContactStatusRequest {
  contact_status: 'uncontacted' | 'contacted';
}
```

**Frontend Usage:**
```javascript
const updateContactStatus = async (leadId, status) => {
  const response = await fetch(`/leads/${leadId}/contact-status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contact_status: status
    })
  });
  return await response.json();
};
```

---

### **7. Update Lead Status**
```
PATCH /leads/:id/status
```

**Request Body:**
```typescript
interface UpdateLeadStatusRequest {
  leads_status: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';
}
```

**Frontend Usage:**
```javascript
const updateLeadStatus = async (leadId, status) => {
  const response = await fetch(`/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      leads_status: status
    })
  });
  return await response.json();
};
```

**Error Cases:**
- `400`: Invalid status value

---

### **8. Get Leads Statistics**
```
GET /leads/stats/overview
```

**Frontend Usage:**
```javascript
const getLeadsStats = async () => {
  const response = await fetch('/leads/stats/overview', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface LeadsStatsResponse {
  success: boolean;
  data: Array<{
    status: string;
    count: number;
  }>;
}
```

---

### **9. Get Leads by User ID**
```
GET /leads/user/:user_id
```

**Frontend Usage:**
```javascript
const getLeadsByUser = async (userId) => {
  const response = await fetch(`/leads/user/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Response Structure:**
```typescript
interface LeadsByUserResponse {
  success: boolean;
  data: Lead[];
  total: number;
  user_id: string;
  message: string;
}
```

---

### **10. Get Leads by Phone**
```
GET /leads/phone/:phone
```

**Frontend Usage:**
```javascript
const getLeadByPhone = async (phoneNumber) => {
  const response = await fetch(`/leads/phone/${phoneNumber}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

**Phone Format:** Numbers only (auto-cleaned: removes non-digits)

---

### **11. Get Leads by UTM**
```
GET /leads/utm/:utm_id
```

**Frontend Usage:**
```javascript
const getLeadsByUTM = async (utmId) => {
  const response = await fetch(`/leads/utm/${utmId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};
```

---

### **12. Bulk Update Leads**
```
PATCH /leads/bulk
```

**Request Body:**
```typescript
interface BulkUpdateRequest {
  lead_ids: string[];    // Array of lead IDs
  updates: {
    utm_id?: string;
    name?: string;
    phone?: string;
    outstanding?: number;
    loan_type?: string;
    leads_status?: 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';
    contact_status?: 'uncontacted' | 'contacted';
  };
}
```

**Frontend Usage:**
```javascript
const bulkUpdateLeads = async (leadIds, updates) => {
  const response = await fetch('/leads/bulk', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      lead_ids: leadIds,
      updates: updates
    })
  });
  return await response.json();
};

// Usage example:
const result = await bulkUpdateLeads(
  ['lead-1', 'lead-2', 'lead-3'],
  { leads_status: 'warm' }
);
```

**Response Structure:**
```typescript
interface BulkUpdateResponse {
  success: boolean;
  data: Lead[];
  updated: number;
  requested: number;
}
```

---

## 🛠️ **NEXT.JS INTEGRATION EXAMPLES**

### **1. Custom Hook for Rooms**
```typescript
// hooks/useRooms.ts
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export const useRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchRooms = async () => {
    try {
      const response = await fetch('/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setRooms(data.data.rooms);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token]);

  return { rooms, loading, refetch: fetchRooms };
};
```

### **2. Custom Hook for Leads**
```typescript
// hooks/useLeads.ts
import { useState, useEffect } from 'react';

export const useLeads = (filters = {}) => {
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      const response = await fetch(`/leads?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setLeads(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [JSON.stringify(filters)]);

  return { leads, pagination, loading, refetch: fetchLeads };
};
```

### **3. API Wrapper Service**
```typescript
// services/api.ts
class ApiService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Rooms API
  async getRooms(token: string) {
    return this.request('/rooms', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async assignUserToRoom(roomId: string, userId: string, token: string) {
    return this.request(`/rooms/${roomId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId })
    });
  }

  // Leads API
  async getLeads(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/leads?${params}`);
  }

  async createLead(leadData: any) {
    return this.request('/leads', {
      method: 'POST',
      body: JSON.stringify(leadData)
    });
  }

  async updateLeadStatus(leadId: string, status: string) {
    return this.request(`/leads/${leadId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ leads_status: status })
    });
  }
}

export const api = new ApiService();
```

### **4. Error Handling**
```typescript
// utils/errorHandler.ts
export const handleApiError = (error: any) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // Redirect to login
        window.location.href = '/login';
        break;
      case 403:
        return 'Access denied. You do not have permission to perform this action.';
      case 404:
        return 'Resource not found.';
      case 409:
        return data.error || 'Conflict occurred.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return data.error || 'An unexpected error occurred.';
    }
  }
  
  return 'Network error. Please check your connection.';
};
```

---

## 🔐 **AUTHENTICATION HANDLING**

### **Token Storage:**
```typescript
// utils/auth.ts
export const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
};

export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
};

export const removeAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
};
```

### **Protected Routes:**
```typescript
// components/ProtectedRoute.tsx
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    
    if (requiredRole && user?.role !== requiredRole) {
      router.push('/unauthorized');
    }
  }, [user, loading, requiredRole]);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return children;
};
```

---

## 📝 **FRONTEND CHECKLIST**

### **Environment Variables:**
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### **Required Dependencies:**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### **API Integration Steps:**
1. ✅ Set up environment variables
2. ✅ Create API service wrapper
3. ✅ Implement authentication handling
4. ✅ Create custom hooks for data fetching
5. ✅ Add error handling
6. ✅ Implement protected routes
7. ✅ Add TypeScript interfaces
8. ✅ Test all endpoints

**Happy coding! 🚀**