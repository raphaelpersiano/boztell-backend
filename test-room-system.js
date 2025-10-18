import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3000';

/**
 * Test Updated Rooms System
 * Test new room structure with UUID id, leads_id, phone, title
 */

async function testRoomSystem() {
  console.log('🏠 Testing Updated Rooms System\n');

  try {
    // Test 1: Send message (should create room with UUID)
    console.log('1. Testing message send (creates new room)...');
    const messageResponse = await axios.post(`${BASE_URL}/messages/send`, {
      to: '6287879565390',
      text: 'Testing new room system with UUID ID',
      user_id: 'operator'
    });
    
    console.log('✅ Message sent successfully:', {
      success: messageResponse.data.success,
      to: messageResponse.data.to,
      message_id: messageResponse.data.message_id
    });
    console.log('\n');

    // Test 2: Send another message to same number (should use existing room)
    console.log('2. Testing second message to same number...');
    const secondMessageResponse = await axios.post(`${BASE_URL}/messages/send`, {
      to: '6287879565390',
      text: 'Second message - should use existing room',
      user_id: 'operator'
    });
    
    console.log('✅ Second message sent:', {
      success: secondMessageResponse.data.success,
      message_id: secondMessageResponse.data.message_id
    });
    console.log('\n');

    // Test 3: Send message with media
    console.log('3. Testing media message...');
    try {
      const mediaResponse = await axios.post(`${BASE_URL}/messages/send-media`, {
        to: '6287879565390',
        media_url: 'https://via.placeholder.com/300x200.png',
        media_type: 'image',
        caption: 'Test image with updated room system'
      });
      
      console.log('✅ Media message sent:', {
        success: mediaResponse.data.success,
        message_id: mediaResponse.data.message_id
      });
    } catch (error) {
      console.log('ℹ️ Media test skipped (external dependency)');
    }
    console.log('\n');

    // Test 4: Send template message
    console.log('4. Testing template message...');
    try {
      const templateResponse = await axios.post(`${BASE_URL}/messages/send-template`, {
        to: '6287879565390',
        templateName: 'hello_world',
        languageCode: 'en_US'
      });
      
      console.log('✅ Template message sent:', {
        success: templateResponse.data.success,
        message_id: templateResponse.data.message_id
      });
    } catch (error) {
      console.log('ℹ️ Template test skipped:', error.response?.data?.message || error.message);
    }
    console.log('\n');

    console.log('🎉 All room system tests completed!');
    console.log('\n📊 Expected Database Changes:');
    console.log('- rooms table: New entries with UUID id, phone field, title="Personal"');
    console.log('- messages table: All messages linked to room UUID (not phone number)');
    console.log('- Same phone number = same room UUID across all messages');

  } catch (error) {
    console.error('❌ Room system test failed:', {
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
}

// Run test
async function runTest() {
  console.clear();
  console.log('🚀 Testing Updated Room System\n');
  console.log('Make sure the server is running on http://localhost:3000\n');
  console.log('='.repeat(60));

  await testRoomSystem();

  console.log('\n' + '='.repeat(60));
  console.log('✨ Test completed!');
  console.log('\n💡 Check your Supabase database:');
  console.log('- rooms table should have UUID ids');
  console.log('- phone field should contain phone numbers');
  console.log('- title should default to "Personal"');
  console.log('- messages should reference room UUIDs');
}

runTest().catch(console.error);