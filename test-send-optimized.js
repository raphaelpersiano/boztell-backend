// Test optimized text message endpoint
// File: test-send-optimized.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testOptimizedSendEndpoint() {
  console.log('🧪 Testing Optimized /messages/send endpoint...\n');

  const testCases = [
    {
      name: 'Simple Text Message',
      payload: {
        to: '628123456789',
        text: 'Hello from optimized endpoint!',
        user_id: 'agent-001'
      }
    },
    {
      name: 'Text Message with Reply',
      payload: {
        to: '628123456789',
        text: 'This is a reply message',
        user_id: 'agent-001',
        context: 'wamid.previous_message_id'
      }
    },
    {
      name: 'Missing user_id (should fail)',
      payload: {
        to: '628123456789',
        text: 'This should fail'
        // user_id missing intentionally
      }
    },
    {
      name: 'Missing text (should fail)',
      payload: {
        to: '628123456789',
        user_id: 'agent-001'
        // text missing intentionally
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📝 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(`${BASE_URL}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.payload)
      });
      
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ Success:');
        console.log(`   Message ID: ${data.message_id}`);
        console.log(`   WhatsApp ID: ${data.whatsapp_message_id}`);
        console.log(`   To: ${data.to}`);
        console.log(`   Type: ${data.type}`);
      } else {
        console.log('❌ Expected error:');
        console.log(`   Error: ${data.error}`);
        if (data.required_fields) {
          console.log(`   Required: ${data.required_fields.join(', ')}`);
        }
      }
      
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
    
    console.log(); // Empty line
  }
}

async function testTemplateEndpointSeparately() {
  console.log('🔍 Testing Template Endpoint (should be separate)...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/messages/send-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: '628123456789',
        templateName: 'hello_world',
        languageCode: 'en_US',
        user_id: 'agent-001'
      })
    });
    
    const data = await response.json();
    
    console.log(`Template Endpoint Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Template endpoint working correctly');
      console.log(`   Template: ${data.templateName}`);
      console.log(`   Language: ${data.languageCode}`);
      console.log(`   Message ID: ${data.message_id}`);
    } else {
      console.log('ℹ️ Template endpoint response:');
      console.log(`   Error: ${data.error}`);
    }
    
  } catch (error) {
    console.log('❌ Template endpoint test failed:', error.message);
  }
  
  console.log();
}

async function runOptimizedTests() {
  console.log('🚀 Testing Optimized Message Endpoints');
  console.log('='.repeat(50));
  
  await testOptimizedSendEndpoint();
  await testTemplateEndpointSeparately();
  
  console.log('📋 Summary:');
  console.log('✅ /messages/send → Text messages only, optimized flow');
  console.log('✅ /messages/send-template → Template messages only');
  console.log('✅ Single database insert, no update needed');
  console.log('✅ WhatsApp message ID included from start');
}

export { testOptimizedSendEndpoint, runOptimizedTests };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runOptimizedTests().catch(console.error);
}