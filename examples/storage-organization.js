// Example demonstrating the simplified storage structure
// 1 room chat = 1 phone number (sesuai konsep WhatsApp)

// Structure will be:
// bucket/
//   ├── media/                    # All WhatsApp media (incoming & outgoing)
//   │   ├── 628123456789/         # Customer phone number (room ID)
//   │   │   ├── 2025-08-25/       # Date folder
//   │   │   │   ├── 1724572800000_image.jpg     # Timestamp_originalname
//   │   │   │   ├── 1724573900000_voice.ogg     # Voice messages
//   │   │   │   └── 1724574000000_document.pdf  # Documents
//   │   │   └── 2025-08-26/
//   │   │       ├── 1724659200000_video.mp4
//   │   │       └── 1724660300000_location.jpg
//   │   ├── 14155552222/          # US phone number
//   │   │   └── 2025-08-25/
//   │   │       ├── 1724572800000_sticker.webp
//   │   │       └── 1724573900000_audio.m4a
//   │   └── 447777123456/         # UK phone number
//   │       └── 2025-08-25/
//   │           └── 1724572800000_contact_card.vcf
//   ├── uploads/                  # Manual file uploads
//   │   ├── 628123456789/         # Same phone-based organization
//   │   │   └── 2025-08-25/
//   │   │       └── 1724572800000_manual_upload.jpg
//   │   └── 14155552222/
//   │       └── 2025-08-25/
//   │           └── 1724572800000_profile_pic.png
//   └── exports/                  # Chat exports & backups
//       ├── 628123456789/
//       │   └── chat_export_2025-08-25.json
//       └── 14155552222/
//           └── conversation_backup_2025-08-26.zip

const examples = {
  // Simplified room mappings - Room ID = Customer Phone Number
  roomMappings: [
    {
      roomId: "628123456789",
      customerPhone: "628123456789", 
      folderName: "628123456789",
      description: "Indonesian customer - room ID is phone number directly"
    },
    {
      roomId: "14155552222",
      customerPhone: "14155552222",
      folderName: "14155552222", 
      description: "US customer - clean phone number format"
    },
    {
      roomId: "447777123456",
      customerPhone: "447777123456",
      folderName: "447777123456",
      description: "UK customer - international format"
    },
    {
      roomId: "+62 812-3456-789",
      customerPhone: "628123456789",
      folderName: "628123456789", 
      description: "Phone with formatting - cleaned to digits only"
    }
  ],

  // Example file paths generated with simplified structure
  examplePaths: [
    "media/628123456789/2025-08-25/1724572800000_family_photo.jpg",
    "media/14155552222/2025-08-25/1724573900000_business_card.pdf", 
    "media/447777123456/2025-08-25/1724574000000_voice_message.ogg",
    "uploads/628123456789/2025-08-25/1724575100000_manual_upload.png",
    "exports/14155552222/chat_export_2025-08-25.json"
  ],

  // Simplified API examples - everything based on phone numbers
  apiExamples: [
    {
      endpoint: "GET /api/media/list?phone=628123456789&date=2025-08-25",
      description: "List all media files for customer 628123456789 on August 25, 2025"
    },
    {
      endpoint: "GET /api/media/dates?phone=628123456789", 
      description: "Get all dates that have media files for this customer"
    },
    {
      endpoint: "GET /api/media/stats?phone=628123456789",
      description: "Get storage statistics for customer 628123456789"
    },
    {
      endpoint: "POST /api/media/upload",
      body: "{ room_id: '628123456789', file: <binary> }",
      description: "Upload media file to customer folder (room_id = phone number)"
    },
    {
      endpoint: "GET /api/media/download/628123456789/2025-08-25/1724572800000_photo.jpg",
      description: "Download specific media file from customer folder"
    }
  ],

  // Socket.io room management examples
  socketExamples: [
    {
      event: "room:join",
      data: "{ room_id: '628123456789' }",
      description: "Join chat room for customer 628123456789"
    },
    {
      event: "room:new_message", 
      room: "room:628123456789",
      description: "Broadcast new message to customer 628123456789"
    },
    {
      event: "typing",
      data: "{ room_id: '628123456789', user_id: 'agent_001', is_typing: true }",
      description: "Send typing indicator to customer room"
    }
  ],

  // WhatsApp webhook to room mapping
  webhookToRoom: [
    {
      webhookData: {
        from: "628123456789",
        to: "6281234567890"  // Business phone
      },
      determinedRoomId: "628123456789",
      description: "Customer phone becomes room ID directly"
    },
    {
      webhookData: {
        from: "14155552222", 
        to: "6281234567890"
      },
      determinedRoomId: "14155552222",
      description: "International customer - room ID = customer phone"
    }
  ]
};

console.log('📁 Simplified Storage Structure (1 Room = 1 Phone Number):');
console.log('🎯 Konsep: Setiap nomor telepon customer = 1 room chat');
console.log('📱 Room ID = Customer Phone Number');
console.log('');
console.log(JSON.stringify(examples, null, 2));

// Demonstrate the simplification
console.log('\n🔄 Perbandingan Konsep:');
console.log('❌ Lama: room_id = "phoneNumberId_customerPhone" (kompleks)');
console.log('✅ Baru: room_id = "customerPhone" (sederhana, seperti WhatsApp asli)');
console.log('');
console.log('🗂️  Struktur Folder:');
console.log('   media/628123456789/2025-08-25/  ← Langsung pakai nomor customer');
console.log('   bukan: media/6281234567890_628123456789/  ← Terlalu kompleks');
console.log('');
console.log('💡 Benefit: Mudah dipahami, konsisten dengan pengalaman WhatsApp pengguna!');
