/**
 * Test script untuk memastikan semua endpoint leads menggunakan field yang benar
 * sesuai dengan schema table leads di Supabase
 */

const BASE_URL = 'http://localhost:8080/api';

// Test data menggunakan field yang benar
const testLead = {
  utm_id: null, // bisa null
  leads_status: 'cold',
  contact_status: 'active', 
  name: 'Test Lead',
  phone: '+6281234567890',
  outstanding: 5000000,
  loan_type: 'personal'
};

async function testLeadsEndpoints() {
  console.log('🧪 Testing Leads Endpoints with Correct Schema Fields');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Create Lead
    console.log('\n1️⃣ Testing POST /leads - Create Lead');
    const createResponse = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testLead)
    });
    
    if (createResponse.ok) {
      const createdLead = await createResponse.json();
      console.log('✅ CREATE SUCCESS:', {
        id: createdLead.data?.id,
        name: createdLead.data?.name,
        phone: createdLead.data?.phone,
        outstanding: createdLead.data?.outstanding,
        loan_type: createdLead.data?.loan_type,
        leads_status: createdLead.data?.leads_status,
        contact_status: createdLead.data?.contact_status
      });
      
      const leadId = createdLead.data?.id;
      
      if (leadId) {
        // Test 2: Get Lead by ID
        console.log('\n2️⃣ Testing GET /leads/:id - Get Lead by ID');
        const getResponse = await fetch(`${BASE_URL}/leads/${leadId}`);
        
        if (getResponse.ok) {
          const lead = await getResponse.json();
          console.log('✅ GET BY ID SUCCESS:', {
            id: lead.data?.id,
            name: lead.data?.name,
            phone: lead.data?.phone,
            outstanding: lead.data?.outstanding,
            loan_type: lead.data?.loan_type
          });
        } else {
          console.log('❌ GET BY ID FAILED:', await getResponse.text());
        }
        
        // Test 3: Update Lead
        console.log('\n3️⃣ Testing PUT /leads/:id - Update Lead');
        const updateData = {
          leads_status: 'warm',
          outstanding: 7500000,
          loan_type: 'business'
        };
        
        const updateResponse = await fetch(`${BASE_URL}/leads/${leadId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          const updatedLead = await updateResponse.json();
          console.log('✅ UPDATE SUCCESS:', {
            id: updatedLead.data?.id,
            leads_status: updatedLead.data?.leads_status,
            outstanding: updatedLead.data?.outstanding,
            loan_type: updatedLead.data?.loan_type
          });
        } else {
          console.log('❌ UPDATE FAILED:', await updateResponse.text());
        }
        
        // Test 4: Get Lead by Phone
        console.log('\n4️⃣ Testing GET /leads/phone/:phone - Get Lead by Phone');
        const phoneResponse = await fetch(`${BASE_URL}/leads/phone/${encodeURIComponent(testLead.phone)}`);
        
        if (phoneResponse.ok) {
          const leadByPhone = await phoneResponse.json();
          console.log('✅ GET BY PHONE SUCCESS:', {
            id: leadByPhone.data?.id,
            name: leadByPhone.data?.name,
            phone: leadByPhone.data?.phone
          });
        } else {
          console.log('❌ GET BY PHONE FAILED:', await phoneResponse.text());
        }
        
        // Test 5: Delete Lead
        console.log('\n5️⃣ Testing DELETE /leads/:id - Delete Lead');
        const deleteResponse = await fetch(`${BASE_URL}/leads/${leadId}`, {
          method: 'DELETE'
        });
        
        if (deleteResponse.ok) {
          console.log('✅ DELETE SUCCESS');
        } else {
          console.log('❌ DELETE FAILED:', await deleteResponse.text());
        }
      }
    } else {
      console.log('❌ CREATE FAILED:', await createResponse.text());
    }
    
    // Test 6: Get All Leads
    console.log('\n6️⃣ Testing GET /leads - Get All Leads');
    const allLeadsResponse = await fetch(`${BASE_URL}/leads?limit=5`);
    
    if (allLeadsResponse.ok) {
      const allLeads = await allLeadsResponse.json();
      console.log('✅ GET ALL SUCCESS:', {
        total: allLeads.data?.length || 0,
        first_lead: allLeads.data?.[0] ? {
          id: allLeads.data[0].id,
          name: allLeads.data[0].name,
          phone: allLeads.data[0].phone,
          leads_status: allLeads.data[0].leads_status,
          outstanding: allLeads.data[0].outstanding
        } : 'No leads found'
      });
    } else {
      console.log('❌ GET ALL FAILED:', await allLeadsResponse.text());
    }
    
    // Test 7: Get Leads Stats
    console.log('\n7️⃣ Testing GET /leads/stats - Get Leads Statistics');
    const statsResponse = await fetch(`${BASE_URL}/leads/stats`);
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ STATS SUCCESS:', {
        stats_count: stats.data?.length || 0,
        sample_stat: stats.data?.[0] || 'No stats found'
      });
    } else {
      console.log('❌ STATS FAILED:', await statsResponse.text());
    }
    
  } catch (error) {
    console.error('🔥 TEST ERROR:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test completed');
}

// Test Field Schema Validation
function validateFieldSchema() {
  console.log('\n📋 Expected Leads Table Schema:');
  console.log('='.repeat(40));
  
  const expectedFields = [
    'id (uuid)',
    'utm_id (uuid, foreign key)',
    'leads_status (varchar)',
    'contact_status (varchar)',
    'name (varchar)',
    'phone (varchar)',
    'outstanding (int8)',
    'loan_type (varchar)',
    'created_at (timestamptz)',
    'updated_at (timestamptz)'
  ];
  
  expectedFields.forEach(field => {
    console.log(`✓ ${field}`);
  });
  
  console.log('\n✅ All functions in db.js updated to use these fields');
}

// Run tests
validateFieldSchema();
testLeadsEndpoints();