/**
 * Test script untuk endpoint GET /api/leads/user/:user_id
 */

const BASE_URL = 'http://localhost:8080/api';

async function testLeadsByUserId() {
  console.log('🧪 Testing GET /api/leads/user/:user_id Endpoint');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Test dengan user_id yang valid (jika ada)
    console.log('\n1️⃣ Testing with sample user_id...');
    const testUserId = 'sample-user-uuid'; // Ganti dengan user_id yang valid
    
    const response = await fetch(`${BASE_URL}/leads/user/${testUserId}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS:', {
        user_id: result.user_id,
        total_leads: result.total,
        message: result.message,
        leads_sample: result.data?.slice(0, 2).map(lead => ({
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          leads_status: lead.leads_status,
          loan_type: lead.loan_type
        })) || []
      });
    } else {
      const error = await response.json();
      console.log('ℹ️ Response (expected if no rooms assigned):', {
        status: response.status,
        error: error.error,
        details: error.details
      });
    }
    
    // Test 2: Test dengan user_id kosong (should fail)
    console.log('\n2️⃣ Testing with empty user_id (should fail)...');
    const emptyResponse = await fetch(`${BASE_URL}/leads/user/`);
    
    if (!emptyResponse.ok) {
      console.log('✅ Empty user_id properly rejected with status:', emptyResponse.status);
    } else {
      console.log('❌ Empty user_id was accepted (this should not happen)');
    }
    
    // Test 3: Test dengan user_id yang tidak ada
    console.log('\n3️⃣ Testing with non-existent user_id...');
    const nonExistentUserId = 'non-existent-uuid';
    
    const nonExistentResponse = await fetch(`${BASE_URL}/leads/user/${nonExistentUserId}`);
    
    if (nonExistentResponse.ok) {
      const result = await nonExistentResponse.json();
      console.log('✅ Non-existent user handled properly:', {
        user_id: result.user_id,
        total_leads: result.total,
        message: result.message
      });
    } else {
      console.log('ℹ️ Non-existent user response:', await nonExistentResponse.text());
    }
    
    // Test 4: Test flow explanation
    console.log('\n4️⃣ Endpoint Flow Explanation:');
    console.log('   Step 1: Query room_participants table by user_id → get room_ids');
    console.log('   Step 2: Query rooms table by room_ids → get leads_ids');
    console.log('   Step 3: Query leads table by leads_ids → get leads data');
    console.log('   Result: All leads that user has access to through room assignments');
    
  } catch (error) {
    console.error('🔥 Test error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test completed');
}

// Show endpoint information
console.log('📋 Endpoint Information:');
console.log('='.repeat(30));
console.log('URL: GET /api/leads/user/:user_id');
console.log('Purpose: Get all leads assigned to a user through room participants');
console.log('Flow: user_id → room_participants → rooms → leads');
console.log('Response: Array of leads with user access through rooms');
console.log('');

// Run test
testLeadsByUserId();