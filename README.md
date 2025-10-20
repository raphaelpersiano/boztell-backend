# Boztell Backend - WhatsApp Integration Documentation

## 📋 System Overview

Boztell Backend adalah sistem manajemen pesan WhatsApp berbasis Node.js dengan Supabase sebagai database. Sistem ini mendukung autentikasi pengguna, manajemen room chat berdasarkan role, dan integrasi webhook WhatsApp.

## 🏗️ Architecture

### Database Schema

#### Tables:
1. **users** - Data pengguna dengan role dan status
2. **leads** - Data prospek/customer
3. **rooms** - Room chat dengan UUID dan relasi ke leads
4. **messages** - Pesan dengan identifikasi user/customer
5. **room_participants** - Peserta room untuk agent tertentu

### Key Components:
- **Authentication System**: User-based dengan validasi user_id
- **Room System**: UUID-based rooms dengan akses berdasarkan role
- **Message System**: Distinguishes antara agent dan customer messages
- **Webhook System**: Menangani incoming WhatsApp messages

## 🔐 Security Features

### User ID Validation
- **CRITICAL**: Semua outgoing message endpoints WAJIB memiliki user_id
- Mencegah template messages tampil sebagai customer-sent di frontend
- Webhook incoming messages menggunakan user_id=null untuk customer

### Role-Based Access
- **Admin/Supervisor**: Akses semua rooms
- **Agent**: Hanya akses rooms yang assigned via room_participants
- **Customer**: Auto-create room saat ada incoming message

## 📡 API Endpoints

### Authentication
```
POST /auth/login
POST /auth/register
GET /auth/profile
```

### Rooms Management
```
GET /rooms                    # Get rooms by user role
GET /rooms/:roomId/messages   # Get messages in room
POST /rooms                   # Create new room
```

### Messages (All require user_id)
```
POST /messages/send                    # Send text message
POST /messages/send-template          # Send template message
POST /messages/send-media-image       # Send image
POST /messages/send-media-document    # Send document
POST /messages/send-media-audio       # Send audio
POST /messages/send-media-video       # Send video
POST /messages/send-media-sticker     # Send sticker
POST /messages/send-location          # Send location
POST /messages/send-contacts          # Send contacts
POST /messages/send-quick-reply       # Send quick reply
POST /messages/send-interactive-list  # Send interactive list
POST /messages/send-interactive-button # Send interactive button
```

### Webhook
```
GET /webhook/whatsapp    # Verification endpoint
POST /webhook/whatsapp   # Message receiver endpoint
```

## 🔄 Message Flow

### Outgoing Messages (Agent → Customer)
1. Agent sends message via API dengan user_id
2. API validates user_id (mandatory)
3. Message disimpan ke database dengan user_id
4. WhatsApp API dipanggil untuk kirim pesan
5. Status delivery tracked via webhook

### Incoming Messages (Customer → Agent)
1. WhatsApp webhook menerima payload
2. System extract customer phone dan message
3. Auto-create/find room berdasarkan phone
4. Save message dengan user_id=null (customer identifier)
5. Room participants mendapat notifikasi

## 📝 Database Structure

### rooms table
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id UUID REFERENCES leads(id),
  phone VARCHAR(20) NOT NULL,
  title VARCHAR(255) DEFAULT 'Personal',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### messages table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) NOT NULL,
  user_id UUID REFERENCES users(id), -- NULL = customer message
  content_type VARCHAR(20) NOT NULL,
  content_text TEXT,
  content_media_url TEXT,
  wa_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 User Roles & Access Control

### Admin/Supervisor
- Access semua rooms tanpa batasan
- Dapat assign agents ke specific rooms
- Full message history access

### Agent
- Hanya access rooms yang di-assign
- Dapat send/receive messages dalam assigned rooms
- Auto-assignment untuk incoming messages

### Customer (External)
- Auto-create room saat first message
- Messages saved dengan user_id=null
- Phone number sebagai identifier

## 🔧 Configuration

### Environment Variables
```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# WhatsApp
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Server
PORT=3000
```

### WhatsApp Business API Setup
1. Create WhatsApp Business Account
2. Get Phone Number ID dan Access Token
3. Setup webhook URL: `https://your-domain.com/webhook/whatsapp`
4. Configure verify token di environment

## 🧪 Testing

### Webhook Testing
```bash
node test-webhook-payload.js
```

### Endpoint Testing
```bash
node test-endpoints.js
```

### Media Flow Testing
```bash
node test-media-flow.js
```

## 🚨 Critical Security Notes

### Message Attribution
- **Template messages MUST have user_id** - mencegah tampil sebagai customer
- **Customer messages have user_id=null** - proper identification
- **All outgoing endpoints validate user_id** - mandatory requirement

### Webhook Security
- Verify WhatsApp signatures (implement X-Hub-Signature-256)
- Validate payload structure sebelum processing
- Rate limiting untuk webhook endpoints

## 📊 Monitoring & Logging

### Key Metrics
- Message delivery rates
- Webhook processing times
- Room creation patterns
- User activity levels

### Log Events
- Incoming webhook payloads
- Message send attempts
- Authentication events
- Room access patterns

## 🔄 Auto-Reply System

### Customer Messages
- Detect incoming customer messages
- Extract phone number from webhook
- Send auto-reply if configured
- Log interaction untuk follow-up

### Business Hours
- Configure active hours
- Auto-reply outside hours
- Queue messages untuk agent review

## 📈 Scalability Considerations

### Database Optimization
- Index pada phone, user_id, room_id
- Partition messages table by date
- Archive old messages

### API Performance
- Implement caching untuk frequent queries
- Rate limiting per user/endpoint
- Connection pooling untuk database

## 🛠️ Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] WhatsApp webhook verified
- [ ] SSL certificate installed
- [ ] Monitoring setup
- [ ] Backup strategy implemented

### Health Checks
```
GET /health         # Application health
GET /webhook/verify # WhatsApp connectivity
```

## 📞 Support & Maintenance

### Daily Tasks
- Monitor webhook deliveries
- Check message queue status
- Review error logs
- Validate database integrity

### Weekly Tasks
- Analyze message patterns
- Review user access logs
- Update room assignments
- Performance optimization

## 🔗 Integration Points

### Frontend Requirements
- Handle user_id untuk all outgoing messages
- Display customer messages (user_id=null) differently
- Implement real-time updates via WebSocket
- Role-based UI rendering

### Third-Party Services
- WhatsApp Business API
- Supabase Database
- File storage untuk media
- Notification services

---

## 📋 Quick Start Guide

1. **Setup Environment**
   ```bash
   cp .env.example .env
   # Configure environment variables
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Migrations**
   ```bash
   # Apply database schema
   ```

4. **Start Server**
   ```bash
   npm start
   ```

5. **Test Webhook**
   ```bash
   node test-webhook-payload.js
   ```

Sistem sekarang siap untuk production dengan proper security dan message attribution! 🚀