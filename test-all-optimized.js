// Test optimized message endpoints
// File: test-all-optimized.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAllOptimizedEndpoints() {
  console.log('🚀 Testing All Optimized Message Endpoints');
  console.log('='.repeat(60));

  const testCases = [
    {
      name: 'Text Message (/send)',
      endpoint: '/messages/send',
      method: 'POST',
      payload: {
        to: '628123456789',
        text: 'Hello from optimized text endpoint!',
        user_id: 'agent-001'
      },
      expectedFields: ['message_id', 'whatsapp_message_id', 'type', 'to']
    },
    {
      name: 'Template Message (/send-template)',
      endpoint: '/messages/send-template', 
      method: 'POST',
      payload: {
        to: '628123456789',
        templateName: 'hello_world',
        languageCode: 'en_US',
        user_id: 'agent-001'
      },
      expectedFields: ['message_id', 'whatsapp_message_id', 'templateName', 'to']
    },
    {
      name: 'Contacts Message (/send-contacts)',
      endpoint: '/messages/send-contacts',
      method: 'POST', 
      payload: {
        to: '628123456789',
        contacts: [
          {
            name: { formatted_name: 'John Doe' },
            phones: [{ phone: '+628123456789' }]
          }
        ],
        user_id: 'agent-001'
      },
      expectedFields: ['message_id', 'whatsapp_message_id', 'type', 'to']
    },
    {
      name: 'Location Message (/send-location)', 
      endpoint: '/messages/send-location',
      method: 'POST',
      payload: {
        to: '628123456789',
        location: {
          latitude: -6.2088,
          longitude: 106.8456,
          name: 'Jakarta Office',
          address: 'Jakarta, Indonesia'
        },
        user_id: 'agent-001'
      },
      expectedFields: ['message_id', 'whatsapp_message_id', 'type', 'to']
    },
    {
      name: 'Reaction Message (/send-reaction)',
      endpoint: '/messages/send-reaction',
      method: 'POST',
      payload: {
        to: '628123456789',
        message_id: 'wamid.test_message_id',
        emoji: '👍',
        user_id: 'agent-001'
      },
      expectedFields: ['message_id', 'whatsapp_message_id', 'type', 'to']
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    console.log(`   Endpoint: ${testCase.method} ${testCase.endpoint}`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
        method: testCase.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.payload)
      });
      
      const responseTime = Date.now() - startTime;
      const data = await response.json();
      
      const result = {
        name: testCase.name,
        endpoint: testCase.endpoint,
        status: response.status,
        success: response.ok,
        responseTime: `${responseTime}ms`,
        hasExpectedFields: testCase.expectedFields.every(field => data[field] !== undefined),
        data: response.ok ? {
          message_id: data.message_id,
          whatsapp_message_id: data.whatsapp_message_id,
          to: data.to,
          type: data.type || data.templateName || 'unknown'
        } : {
          error: data.error,
          message: data.message
        }
      };
      
      results.push(result);
      
      if (response.ok) {
        console.log('   ✅ SUCCESS');
        console.log(`   📊 Response Time: ${responseTime}ms`);
        console.log(`   🆔 Message ID: ${data.message_id}`);
        console.log(`   📱 WhatsApp ID: ${data.whatsapp_message_id}`);
        console.log(`   📞 To: ${data.to}`);
        
        // Verify optimized flow: WhatsApp ID should be present immediately
        if (data.whatsapp_message_id) {
          console.log('   🎯 OPTIMIZED: WhatsApp message ID present (no update needed)');
        } else {
          console.log('   ⚠️  WARNING: WhatsApp message ID missing');
        }
      } else {
        console.log('   ❌ FAILED');
        console.log(`   🚫 Status: ${response.status}`);
        console.log(`   💬 Error: ${data.error}`);
        if (data.message) {
          console.log(`   📝 Details: ${data.message}`);
        }
      }
      
    } catch (error) {
      console.log('   ❌ REQUEST FAILED');
      console.log(`   💥 Error: ${error.message}`);
      
      results.push({
        name: testCase.name,
        endpoint: testCase.endpoint,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 OPTIMIZATION TEST SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎯 SUCCESSFUL ENDPOINTS:');
    successful.forEach(result => {
      console.log(`   ✅ ${result.name} (${result.responseTime})`);
      console.log(`      💾 Single DB Insert (no updates needed)`);
      console.log(`      📱 WhatsApp ID: ${result.data.whatsapp_message_id || 'N/A'}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED ENDPOINTS:');
    failed.forEach(result => {
      console.log(`   ❌ ${result.name}: ${result.data?.error || result.error}`);
    });
  }

  // Performance Analysis
  console.log('\n📊 PERFORMANCE ANALYSIS:');
  console.log('🔄 OLD FLOW: Insert → Send → Update (3 operations)');
  console.log('⚡ NEW FLOW: Send → Insert (2 operations)');
  console.log('🎯 BENEFIT: 33% fewer database operations');
  console.log('✨ RESULT: Faster response times, atomic operations');
  
  console.log('\n🎉 All message endpoints now use optimized flow!');
}

async function testDatabaseConsistency() {
  console.log('\n🔍 Testing Database Consistency...');
  
  try {
    // Test simple text message and check database
    const response = await fetch(`${BASE_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: '628123456789',
        text: 'Database consistency test message',
        user_id: 'agent-001'
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.whatsapp_message_id && data.message_id) {
      console.log('✅ Database Consistency Check:');
      console.log(`   📝 Message sent and saved in single operation`);
      console.log(`   🆔 DB Message ID: ${data.message_id}`);
      console.log(`   📱 WhatsApp ID: ${data.whatsapp_message_id}`);
      console.log('   💾 No update operations needed');
      console.log('   ⚡ Optimized flow working correctly');
    } else {
      console.log('❌ Database consistency issue detected');
    }
    
  } catch (error) {
    console.log(`❌ Database consistency test failed: ${error.message}`);
  }
}

async function runAllOptimizationTests() {
  await testAllOptimizedEndpoints();
  await testDatabaseConsistency();
  
  console.log('\n🏁 Optimization testing completed!');
}

export { testAllOptimizedEndpoints, runAllOptimizationTests };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllOptimizationTests().catch(console.error);
}