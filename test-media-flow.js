// Test script to simulate media processing without WhatsApp API
import { v4 as uuidv4 } from 'uuid';
import { query } from './src/db.js';
import { uploadBuffer } from './src/services/storageService.js';
import { logger } from './src/utils/logger.js';

async function testMediaProcessing() {
  console.log('🧪 Testing Media Processing Flow...\n');
  
  try {
    // 1. Create test buffer (simulate downloaded media)
    const testBuffer = Buffer.from('Test media content - this would be actual image/video data');
    const messageId = uuidv4();
    const roomId = '628123456789';
    
    console.log('1️⃣ Testing S3 Upload...');
    
    // 2. Test upload to S3
    const gcsData = await uploadBuffer({
      buffer: testBuffer,
      filename: 'test_image.jpg',
      contentType: 'image/jpeg',
      folder: 'whatsapp-media',
      roomId: roomId,
      phoneNumber: '628123456789'
    });
    
    console.log(`✅ S3 Upload Success:`);
    console.log(`   GCS Filename: ${gcsData.gcsFilename}`);
    console.log(`   GCS URL: ${gcsData.url}`);
    console.log(`   File Size: ${gcsData.size} bytes\n`);
    
    console.log('2️⃣ Testing Database Save...');
    
    // 3. Test database save
    const sql = `
      INSERT INTO messages (
        id, room_id, sender_id, sender, content_type, content_text,
        media_type, media_id, gcs_filename, gcs_url, file_size, mime_type,
        original_filename, wa_message_id, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, 'media', $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, NOW()
      ) RETURNING *;
    `;
    
    const params = [
      messageId, roomId, '628123456789', 'Test User', 'Test gambar dari HP',
      'image', 'test_media_id_123', gcsData.gcsFilename, gcsData.url, gcsData.size,
      'image/jpeg', 'test_image.jpg', 'wamid.test123', JSON.stringify({ test: true })
    ];
    
    const { rows } = await query(sql, params);
    const savedMessage = rows[0];
    
    console.log(`✅ Database Save Success:`);
    console.log(`   Message ID: ${savedMessage.id}`);
    console.log(`   Room ID: ${savedMessage.room_id}`);
    console.log(`   Media Type: ${savedMessage.media_type}`);
    console.log(`   GCS URL: ${savedMessage.gcs_url}\n`);
    
    console.log('🎉 Media Processing Flow Complete!');
    console.log('✅ S3 Upload: Working');
    console.log('✅ Database Save: Working');
    console.log('✅ Ready for real WhatsApp media!\n');
    
    // 4. Test reading back
    const readSql = `SELECT * FROM messages WHERE id = $1`;
    const { rows: readRows } = await query(readSql, [messageId]);
    console.log('📖 Message Read Back:', readRows[0].content_type, readRows[0].media_type);
    
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run test
testMediaProcessing();
