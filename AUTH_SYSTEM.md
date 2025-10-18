# User Authentication System

Sistem autentikasi berbasis PIN untuk CRM Boztell dengan integrasi pesan WhatsApp.

## 🏗️ **Arsitektur**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend CRM  │───▶│  Authentication  │───▶│   User Table    │
│    (NextJS)     │    │     Routes       │    │   (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Message Send   │
                       │   (user_id →     │
                       │   sender_name)   │
                       └──────────────────┘
```

## 📊 **Database Schema**

### User Table (`users`)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    pin INTEGER NOT NULL CHECK (pin >= 100000 AND pin <= 999999), -- 6 digit PIN
    role VARCHAR(50) NOT NULL DEFAULT 'agent',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sample Data
```sql
INSERT INTO users (name, phone, email, pin, role, is_active) VALUES
    ('Admin User', '6281234567890', 'admin@boztell.com', 123456, 'admin', true),
    ('Customer Service', '6281234567891', 'cs@boztell.com', 654321, 'agent', true),
    ('Sales Agent', '6281234567892', 'sales@boztell.com', 111111, 'agent', true),
    ('Manager', '6281234567893', 'manager@boztell.com', 999999, 'manager', true);
```

## � **Route Integration**

### Auth Routes (`/api/auth/*`)
- **Purpose**: Authentication, session management, user lookup untuk messaging
- **Focus**: Login, PIN management, message sender lookup
- **Filters**: role, is_active untuk get users

### Users Routes (`/users/*`)  
- **Purpose**: Full user management (CRUD operations)
- **Focus**: Admin management, user profiles, role management
- **Filters**: role, is_active untuk listing users

### Shared Functions (userService.js)
- ✅ **createUser()** - Used by both routes
- ✅ **getUsersFiltered()** - Shared filtering logic
- ✅ **getSingleUser()** - Single user retrieval
- ✅ **updateUserData()** - General updates (no PIN)
- ✅ **updateUserPin()** - PIN-specific updates (auth only)
- ✅ **removeUser()** - User deletion
- ✅ **getUserForMessage()** - Message integration

## �🔐 **Authentication Endpoints**

### 1. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "admin@boztell.com", // email or phone
  "pin": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": "uuid",
    "name": "Admin User",
    "phone": "6281234567890",
    "email": "admin@boztell.com",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

### 2. Get User (for message lookup)
```http
GET /api/auth/user/{userId}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Admin User",
    "phone": "6281234567890",
    "email": "admin@boztell.com"
  }
}
```

### 3. Validate Session
```http
POST /api/auth/validate-session
Content-Type: application/json

{
  "userId": "uuid"
}
```

### 4. Create User (Admin)
```http
POST /api/auth/users
Content-Type: application/json

{
  "name": "New Agent",
  "phone": "6281234567899",
  "email": "agent@boztell.com",
  "pin": "555555"
}
```

### 5. Update PIN
```http
PUT /api/auth/user/{userId}/pin
Content-Type: application/json

{
  "oldPin": "123456",
  "newPin": "654321"
}
```

### 6. Get All Users (Admin)
```http
GET /api/auth/users
```

### 7. Delete User (Admin)
```http
DELETE /api/auth/user/{userId}
```

## � **Users Management Endpoints**

### 1. Get All Users
```http
GET /users
GET /users?role=agent
GET /users?is_active=true
GET /users?role=manager&is_active=true
```

### 2. Get Single User
```http
GET /users/{userId}
```

### 3. Create User (Full)
```http
POST /users
Content-Type: application/json

{
  "name": "New Agent",
  "phone": "6281234567899",
  "email": "agent@boztell.com",
  "pin": "555555",
  "role": "agent",
  "avatar_url": "https://example.com/avatar.jpg",
  "is_active": true
}
```

### 4. Update User
```http
PUT /users/{userId}
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "manager",
  "avatar_url": "https://example.com/new-avatar.jpg",
  "is_active": false
}
```

### 5. Delete User
```http
DELETE /users/{userId}
```

### 6. Get Agents Only
```http
GET /users/agents/list
```

## �📱 **Message Integration**

### Updated Message Endpoints

Semua endpoint pesan sekarang mendukung `user_id` untuk lookup otomatis `sender_name`:

```http
POST /messages/send
Content-Type: application/json

{
  "to": "6287879565390",
  "text": "Hello from authenticated user",
  "user_id": "uuid" // Will lookup sender_name from user table
}
```

**Automatic sender lookup:**
- ✅ `user_id` provided → lookup `sender_name` from user table
- ✅ `user_id` not found → use fallback `sender_name`
- ✅ `user_id` = 'operator' → use default 'Operator'

### Supported Message Types with Authentication:
- ✅ Text messages (`/messages/send`)
- ✅ Media messages (`/messages/send-media-combined`)
- ✅ Template messages (`/messages/send-template`)
- ✅ Contact messages (`/messages/send-contacts`)
- ✅ Location messages (`/messages/send-location`)

## 🛠️ **Implementation Details**

### User Service (`src/services/userService.js`)
- **authenticateUser()** - PIN-based login
- **getUserForMessage()** - Lookup for messaging
- **createUser()** - Admin user creation
- **updateUserPin()** - PIN management
- **getAllUsers()** - Admin user listing
- **removeUser()** - Admin user deletion

### Message Integration (`src/routes/messages.js`)
- **getSenderInfo()** - Helper function for user lookup
- Integrated in all message endpoints
- Fallback mechanism for missing users
- Automatic sender_name resolution

### Database Functions (`src/db.js`)
- **getUsers()** - Query with filters
- **getUserById()** - Single user lookup
- **insertUser()** - Create new user
- **updateUser()** - Update user data
- **deleteUser()** - Remove user

## 🧪 **Testing**

### Run Tests
```bash
# Start server
npm run dev

# Run authentication tests
node test-auth.js

# Run users integration tests
node test-users-integration.js
```

### Test Scenarios
1. ✅ Valid login with email/phone + PIN
2. ✅ Invalid PIN rejection
3. ✅ User not found handling
4. ✅ Session validation
5. ✅ User lookup for messaging
6. ✅ Message sending with authentication
7. ✅ User creation (admin)
8. ✅ Fallback sender names

## 🚀 **Frontend Integration**

### NextJS CRM Integration

```javascript
// Login function
const login = async (identifier, pin) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, pin })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }
  throw new Error(data.message);
};

// Send message with authentication
const sendMessage = async (to, text, userId) => {
  const response = await fetch('/api/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, user_id: userId })
  });
  
  return response.json();
};
```

## 🔒 **Security Features**

- ✅ **6-digit PIN validation** - Database constraint
- ✅ **Unique email/phone** - Database constraint
- ✅ **Input validation** - Server-side validation
- ✅ **Error handling** - Proper error responses
- ✅ **No password exposure** - PIN not returned in responses
- ✅ **Session validation** - User existence check
- ✅ **SQL injection protection** - Parameterized queries

## 📈 **Performance Optimizations**

- ✅ **Database indexes** - phone, email, pin
- ✅ **Efficient queries** - Single lookup per message
- ✅ **Caching ready** - User data can be cached
- ✅ **Minimal payload** - Only necessary data returned

## 🎯 **Usage Flow**

1. **CRM Login** → User enters email/phone + PIN
2. **Authentication** → Server validates and returns user data
3. **Session Storage** → Frontend stores user ID
4. **Message Sending** → Include user_id in message requests
5. **Automatic Lookup** → Server gets sender_name from user table
6. **Database Storage** → Message saved with correct sender info

## 🛡️ **Error Handling**

```javascript
// All responses follow consistent format
{
  "success": boolean,
  "message": string,
  "user"?: object,
  "error"?: string
}
```

### Common Error Responses:
- `400` - Missing required fields
- `401` - Invalid credentials
- `404` - User not found
- `500` - Internal server error

---

**✨ Ready untuk production!** Sistem authentication terintegrasi penuh dengan sistem pesan WhatsApp.