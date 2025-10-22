# Leads Status Update Endpoint Documentation

## ✅ **ENDPOINT TELAH DIPERBAIKI DAN SIAP DIGUNAKAN**

### 📊 **Valid Leads Status Options**

Berikut adalah opsi `leads_status` yang valid sesuai permintaan:

1. **`cold`** - Lead baru, belum ada interaksi
2. **`warm`** - Lead sudah ada interaksi awal
3. **`hot`** - Lead menunjukkan minat tinggi
4. **`paid`** - Lead sudah melakukan pembayaran
5. **`service`** - Lead dalam tahap pelayanan
6. **`repayment`** - Lead dalam masa pembayaran kembali
7. **`advocate`** - Lead menjadi advocate/promoter

---

## 🔗 **API Endpoint**

### **PATCH `/api/leads/:id/status`**

**Deskripsi:** Update status leads berdasarkan ID

**Method:** `PATCH`

**URL:** `http://localhost:8080/api/leads/:id/status`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "leads_status": "warm"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "utm_id": null,
    "leads_status": "warm",
    "contact_status": "active",
    "name": "John Doe",
    "phone": "+628123456789",
    "outstanding": 5000000,
    "loan_type": "personal",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:30:00Z"
  }
}
```

**Response Error (400) - Missing Status:**
```json
{
  "success": false,
  "error": "leads_status is required",
  "valid_values": ["cold", "warm", "hot", "paid", "service", "repayment", "advocate"]
}
```

**Response Error (400) - Invalid Status:**
```json
{
  "success": false,
  "error": "Invalid leads_status: invalid_status",
  "valid_values": ["cold", "warm", "hot", "paid", "service", "repayment", "advocate"]
}
```

**Response Error (404) - Lead Not Found:**
```json
{
  "success": false,
  "error": "Lead not found"
}
```

---

## 📝 **Usage Examples**

### 1. Update Status ke "hot"
```bash
curl -X PATCH http://localhost:8080/api/leads/uuid/status \
  -H "Content-Type: application/json" \
  -d '{"leads_status": "hot"}'
```

### 2. Update Status ke "paid"
```bash
curl -X PATCH http://localhost:8080/api/leads/uuid/status \
  -H "Content-Type: application/json" \
  -d '{"leads_status": "paid"}'
```

### 3. Update Status ke "service"
```bash
curl -X PATCH http://localhost:8080/api/leads/uuid/status \
  -H "Content-Type: application/json" \
  -d '{"leads_status": "service"}'
```

---

## 🔒 **Validation Rules**

### ✅ **Valid Status Transitions**
Semua status dapat di-update ke status manapun. Tidak ada pembatasan transisi.

### ❌ **Invalid Inputs**
- Status kosong atau null
- Status yang tidak ada dalam daftar valid
- ID leads yang tidak ditemukan

### 🛡️ **Input Sanitization**
- `leads_status` harus berupa string
- Tidak case-sensitive (otomatis lowercase)
- Whitespace akan di-trim

---

## 📈 **Integration dengan Statistics**

### **GET `/api/leads/stats`**

Function `getLeadsStats()` di `db.js` sudah diupdate untuk menggunakan status yang baru:

**Status Order dalam Statistics:**
```javascript
const statusOrder = ['cold', 'warm', 'hot', 'paid', 'service', 'repayment', 'advocate'];
```

**Response Statistics:**
```json
{
  "success": true,
  "data": [
    {
      "leads_status": "cold",
      "count": 50,
      "total_amount": 250000000
    },
    {
      "leads_status": "warm", 
      "count": 30,
      "total_amount": 180000000
    },
    {
      "leads_status": "hot",
      "count": 20,
      "total_amount": 150000000
    },
    {
      "leads_status": "paid",
      "count": 15,
      "total_amount": 100000000
    },
    {
      "leads_status": "service",
      "count": 10,
      "total_amount": 75000000
    },
    {
      "leads_status": "repayment",
      "count": 8,
      "total_amount": 60000000
    },
    {
      "leads_status": "advocate",
      "count": 5,
      "total_amount": 40000000
    }
  ]
}
```

---

## 🔄 **Workflow Integration**

### **Message → Room → Lead Status Flow**
1. **Message masuk** → Auto-create room & lead (status: `cold`)
2. **Agent response** → Status bisa diupdate ke `warm`
3. **Lead interested** → Status diupdate ke `hot`
4. **Payment made** → Status diupdate ke `paid`
5. **Service ongoing** → Status diupdate ke `service`
6. **Repayment phase** → Status diupdate ke `repayment`
7. **Happy customer** → Status diupdate ke `advocate`

### **Bulk Update Support**

Status bisa diupdate secara bulk via endpoint:
```
PATCH /api/leads/bulk
```

Request body:
```json
{
  "lead_ids": ["uuid1", "uuid2", "uuid3"],
  "updates": {
    "leads_status": "paid"
  }
}
```

---

## ⚡ **Performance Notes**

### **Database Indexing**
Pastikan index pada kolom `leads_status` untuk query performa:
```sql
CREATE INDEX idx_leads_status ON leads(leads_status);
```

### **Caching Strategy**
Statistics endpoint bisa di-cache karena status transition tidak terlalu frequent.

---

## 🧪 **Testing**

### **Manual Test Script**
File `test-leads-status.js` sudah dibuat untuk testing semua status transitions.

**Run Test:**
```bash
# Start server
npm start

# Run test (in new terminal)
node test-leads-status.js
```

### **Test Cases Covered**
1. ✅ Update ke semua 7 status valid
2. ✅ Reject invalid status
3. ✅ Reject missing status  
4. ✅ Lead not found scenario
5. ✅ Statistics integration
6. ✅ Cleanup test data

---

## 📋 **Implementation Summary**

### **Files Modified:**

1. **`src/routes/leads.js`** (Line 238-260)
   - Added validation untuk 7 status options
   - Improved error messages dengan valid_values
   - Added invalid status rejection

2. **`src/db.js`** (Line 903)
   - Updated `statusOrder` dalam `getLeadsStats()`
   - Changed dari: `['cold', 'warm', 'hot', 'qualified', 'converted', 'lost']`
   - Menjadi: `['cold', 'warm', 'hot', 'paid', 'service', 'repayment', 'advocate']`

### **Features Added:**
- ✅ Complete status validation
- ✅ Proper error handling
- ✅ Integration dengan statistics
- ✅ Bulk update support
- ✅ Test script untuk validation

---

## 🎯 **Ready for Production**

Endpoint `PATCH /api/leads/:id/status` sudah **100% ready** dengan:

- ✅ Semua 7 status options yang diminta
- ✅ Validation lengkap
- ✅ Error handling proper
- ✅ Integration dengan statistics
- ✅ Documentation lengkap
- ✅ Test cases siap

**Silakan mulai menggunakan endpoint ini untuk update leads status! 🚀**