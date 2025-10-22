/**
 * Test script untuk endpoint update leads_status dengan opsi yang benar
 */

const BASE_URL = 'http://localhost:8080/api';

// Test semua opsi leads_status yang valid
const validStatuses = ['cold', 'warm', 'hot', 'paid', 'service', 'repayment', 'advocate'];

async function testLeadsStatusUpdate() {
  console.log('🧪 Testing Leads Status Update Endpoint');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Create test lead
    console.log('\n1️⃣ Creating test lead...');
    const testLead = {
      name: 'Test Lead Status',
      phone: '+628999888777',
      loan_type: 'personal',
      leads_status: 'cold',
      contact_status: 'active',
      outstanding: 1000000
    };
    
    const createResponse = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testLead)
    });
    
    if (!createResponse.ok) {
      console.log('❌ Failed to create test lead:', await createResponse.text());
      return;
    }
    
    const createdLead = await createResponse.json();
    const leadId = createdLead.data?.id;
    console.log('✅ Test lead created:', { id: leadId, initial_status: 'cold' });
    
    // Step 2: Test each valid status
    console.log('\n2️⃣ Testing all valid leads_status values:');
    
    for (const status of validStatuses) {
      console.log(`\n   Testing status: ${status}`);
      
      const updateResponse = await fetch(`${BASE_URL}/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads_status: status })
      });
      
      if (updateResponse.ok) {
        const result = await updateResponse.json();
        console.log(`   ✅ ${status}: SUCCESS - Updated to ${result.data.leads_status}`);
      } else {
        const error = await updateResponse.text();
        console.log(`   ❌ ${status}: FAILED - ${error}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Step 3: Test invalid status
    console.log('\n3️⃣ Testing invalid status (should fail):');
    const invalidResponse = await fetch(`${BASE_URL}/leads/${leadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads_status: 'invalid_status' })
    });
    
    if (!invalidResponse.ok) {
      const errorData = await invalidResponse.json();
      console.log('✅ Invalid status properly rejected:', {
        error: errorData.error,
        valid_values: errorData.valid_values
      });
    } else {
      console.log('❌ Invalid status was accepted (this should not happen)');
    }
    
    // Step 4: Test missing status
    console.log('\n4️⃣ Testing missing leads_status (should fail):');
    const missingResponse = await fetch(`${BASE_URL}/leads/${leadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!missingResponse.ok) {
      const errorData = await missingResponse.json();
      console.log('✅ Missing status properly rejected:', {
        error: errorData.error,
        valid_values: errorData.valid_values
      });
    } else {
      console.log('❌ Missing status was accepted (this should not happen)');
    }
    
    // Step 5: Test leads statistics
    console.log('\n5️⃣ Testing leads statistics:');
    const statsResponse = await fetch(`${BASE_URL}/leads/stats`);
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Stats endpoint working:', {
        total_status_types: stats.data?.length || 0,
        status_breakdown: stats.data?.map(s => `${s.leads_status}: ${s.count} leads`) || []
      });
    } else {
      console.log('❌ Stats failed:', await statsResponse.text());
    }
    
    // Step 6: Cleanup - delete test lead
    console.log('\n6️⃣ Cleaning up test lead...');
    const deleteResponse = await fetch(`${BASE_URL}/leads/${leadId}`, {
      method: 'DELETE'
    });
    
    if (deleteResponse.ok) {
      console.log('✅ Test lead deleted successfully');
    } else {
      console.log('⚠️ Failed to delete test lead:', await deleteResponse.text());
    }
    
  } catch (error) {
    console.error('🔥 Test error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Leads status update test completed');
}

// Show valid status options
console.log('📋 Valid leads_status options:');
console.log('='.repeat(30));
validStatuses.forEach((status, index) => {
  console.log(`${index + 1}. ${status}`);
});
console.log('');

// Run test
testLeadsStatusUpdate();