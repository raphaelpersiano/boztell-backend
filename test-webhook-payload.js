// Test script untuk simulasi webhook WhatsApp payload
// File: test-webhook-payload.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Sample WhatsApp webhook payload for incoming text message
const sampleTextWebhook = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550559999",
              "phone_number_id": "12345678901234567"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe Customer"
                },
                "wa_id": "628123456789"
              }
            ],
            "messages": [
              {
                "from": "628123456789",
                "id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgSQUIzM0FENEQ5NjM4M0Q3RTAA",
                "timestamp": "1729688400",
                "text": {
                  "body": "Hello, I need help with my account"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

// Sample WhatsApp webhook payload for incoming media message
const sampleMediaWebhook = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550559999",
              "phone_number_id": "12345678901234567"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Jane Smith Customer"
                },
                "wa_id": "628234567890"
              }
            ],
            "messages": [
              {
                "from": "628234567890",
                "id": "wamid.HBgMNjI4MjM0NTY3ODkwFQIAERgSQUIzM0FENEQ5NjM4M0Q3RTBB",
                "timestamp": "1729688460",
                "type": "image",
                "image": {
                  "caption": "Here is my problem screenshot",
                  "mime_type": "image/jpeg",
                  "sha256": "4GsuuVkKy4bJ/xpZpyF0JJQ5zKf7mMJM2dZVvvHFfmc=",
                  "id": "1234567890123456789"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

// Sample WhatsApp webhook payload for message status
const sampleStatusWebhook = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550559999",
              "phone_number_id": "12345678901234567"
            },
            "statuses": [
              {
                "id": "wamid.HBgMNjI4MTIzNDU2Nzg5FQIAERgSQUIzM0FENEQ5NjM4M0Q3RTAA",
                "status": "delivered",
                "timestamp": "1729688500",
                "recipient_id": "628123456789"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

async function testWebhookPayload() {
  console.log('🧪 Testing WhatsApp Webhook Payload Processing...\n');

  const testCases = [
    {
      name: 'Incoming Text Message',
      payload: sampleTextWebhook,
      expectedType: 'text_message'
    },
    {
      name: 'Incoming Media Message',
      payload: sampleMediaWebhook,
      expectedType: 'media_message'
    },
    {
      name: 'Message Status Update',
      payload: sampleStatusWebhook,
      expectedType: 'status_update'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📝 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(`${BASE_URL}/webhook/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: In real WhatsApp, there would be X-Hub-Signature-256 header
          // Skipping signature for testing purposes
        },
        body: JSON.stringify(testCase.payload)
      });
      
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ Webhook processed successfully');
        console.log(`   Processed: ${data.processed || 0} events`);
        if (data.results) {
          data.results.forEach((result, index) => {
            console.log(`   Result ${index + 1}:`, {
              type: result.type,
              room_id: result.room_id,
              message_id: result.message_id,
              wa_message_id: result.wa_message_id
            });
          });
        }
      } else {
        console.log('❌ Webhook failed:');
        console.log('   Error:', data.error);
        console.log('   Details:', data.message || 'No details');
      }
      
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
    
    console.log(); // Empty line for readability
  }
}

async function testWebhookVerification() {
  console.log('🔍 Testing Webhook Verification (Setup)...\n');
  
  try {
    const verifyUrl = `${BASE_URL}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=your-verify-token&hub.challenge=CHALLENGE_ACCEPTED`;
    
    const response = await fetch(verifyUrl);
    const data = await response.text();
    
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${data}`);
    
    if (response.status === 200 && data === 'CHALLENGE_ACCEPTED') {
      console.log('✅ Webhook verification working correctly');
    } else {
      console.log('❌ Webhook verification failed');
      console.log('   Make sure WHATSAPP_VERIFY_TOKEN is set correctly');
    }
    
  } catch (error) {
    console.log('❌ Verification test failed:', error.message);
  }
  
  console.log();
}

async function checkDatabaseAfterWebhook() {
  console.log('📊 Database Check Instructions:\n');
  
  console.log('After running webhook tests, check Supabase database:');
  console.log('1. messages table should have new rows with:');
  console.log('   - user_id: NULL (for customer messages)');
  console.log('   - room_id: UUID of created room');
  console.log('   - wa_message_id: WhatsApp message ID');
  console.log('   - content_type: "text" or "media"');
  console.log('   - content_text: Message content');
  
  console.log('\n2. rooms table should have new rooms with:');
  console.log('   - id: UUID');
  console.log('   - phone: Customer phone number');
  console.log('   - title: Customer name or "Personal"');
  
  console.log('\n3. Check logs for processing details:');
  console.log('   - "Incoming message saved to database"');
  console.log('   - "WhatsApp webhook processed successfully"');
  
  console.log('\n🔍 SQL Query to check recent messages:');
  console.log(`
  SELECT 
    m.id,
    m.room_id,
    m.user_id,
    m.content_type,
    m.content_text,
    m.wa_message_id,
    m.created_at,
    r.phone,
    r.title
  FROM messages m
  LEFT JOIN rooms r ON m.room_id = r.id
  WHERE m.created_at > NOW() - INTERVAL '1 hour'
  ORDER BY m.created_at DESC
  LIMIT 10;
  `);
}

// Run tests
async function runWebhookTests() {
  console.log('🚀 Starting WhatsApp Webhook Tests');
  console.log('='.repeat(50));
  
  await testWebhookVerification();
  await testWebhookPayload();
  await checkDatabaseAfterWebhook();
  
  console.log('✅ Webhook tests completed');
}

// Export functions for use in other files
export { testWebhookPayload, testWebhookVerification, runWebhookTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWebhookTests().catch(console.error);
}