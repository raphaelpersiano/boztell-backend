// Test script untuk Room Chat API
// File: test-room-api.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Test data - contoh user IDs yang akan didapat dari login
const TEST_USER_IDS = {
  admin: 'admin-001',        // Admin User ID
  supervisor: 'supervisor-001', // Supervisor User ID
  agent: 'agent-001'         // Agent User ID
};

async function testRoomAPI() {
  console.log('🧪 Testing Room Chat API endpoints...\n');

  // Test 1: Admin mendapatkan semua rooms
  console.log('1️⃣  Testing Admin - Get All Rooms');
  try {
    const response = await fetch(`${BASE_URL}/api/rooms`, {
      headers: {
        'x-user-id': TEST_USER_IDS.admin
      }
    });
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    if (data.success) {
      console.log(`✅ Total rooms for admin: ${data.data?.total_count || 0}`);
      console.log('📋 Sample room data:', data.data?.rooms?.[0] || 'No rooms found');
    } else {
      console.log('❌ Error:', data.error);
    }
    console.log();
  } catch (error) {
    console.error('Error testing admin rooms:', error.message);
  }

  // Test 2: Supervisor mendapatkan semua rooms
  console.log('2️⃣  Testing Supervisor - Get All Rooms');
  try {
    const response = await fetch(`${BASE_URL}/api/rooms`, {
      headers: {
        'x-user-id': TEST_USER_IDS.supervisor
      }
    });
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(`Total rooms for supervisor: ${data.data?.total_count || 0}\n`);
  } catch (error) {
    console.error('Error testing supervisor rooms:', error.message);
  }

  // Test 3: Agent mendapatkan assigned rooms saja
  console.log('3️⃣  Testing Agent - Get Assigned Rooms');
  try {
    const response = await fetch(`${BASE_URL}/api/rooms`, {
      headers: {
        'x-user-id': TEST_USER_IDS.agent
      }
    });
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(`Total rooms for agent: ${data.data?.total_count || 0}\n`);
  } catch (error) {
    console.error('Error testing agent rooms:', error.message);
  }

  // Test 4: Unauthenticated access
  console.log('4️⃣  Testing Unauthenticated Access');
  try {
    const response = await fetch(`${BASE_URL}/api/rooms`);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing unauthenticated access:', error.message);
  }

  // Test 5: Invalid PIN
  console.log('5️⃣  Testing Invalid PIN');
  try {
    const response = await fetch(`${BASE_URL}/api/rooms`, {
      headers: {
        'x-user-pin': 'invalid-pin'
      }
    });
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing invalid PIN:', error.message);
  }

  // Test 6: Get specific room (if room ID available)
  console.log('6️⃣  Testing Get Specific Room');
  try {
    // First get rooms to find a room ID
    const roomsResponse = await fetch(`${BASE_URL}/api/rooms`, {
      headers: {
        'x-user-pin': TEST_PINS.admin
      }
    });
    const roomsData = await roomsResponse.json();
    
    if (roomsData.data?.rooms?.length > 0) {
      const firstRoomId = roomsData.data.rooms[0].room_id;
      
      const response = await fetch(`${BASE_URL}/api/rooms/${firstRoomId}`, {
        headers: {
          'x-user-pin': TEST_PINS.admin
        }
      });
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('No rooms available to test specific room endpoint');
    }
  } catch (error) {
    console.error('Error testing specific room:', error.message);
  }
}

// Helper function to test with different authentication methods
async function testAuthMethods() {
  console.log('\n🔐 Testing Different Authentication Methods...\n');

  const testCases = [
    {
      name: 'x-user-id Header',
      headers: {
        'x-user-id': TEST_USER_IDS.admin
      }
    },
    {
      name: 'Query Parameter',
      url: `${BASE_URL}/api/rooms?user_id=${TEST_USER_IDS.admin}`,
      headers: {}
    },
    {
      name: 'Request Body',
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({ user_id: TEST_USER_IDS.admin })
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    try {
      const url = testCase.url || `${BASE_URL}/api/rooms`;
      const response = await fetch(url, {
        headers: testCase.headers
      });
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log(`Success: ${data.success}`);
      console.log(`Total rooms: ${data.data?.total_count || 0}\n`);
    } catch (error) {
      console.error(`Error: ${error.message}\n`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Room API Tests');
  console.log('='.repeat(50));
  
  await testRoomAPI();
  await testAuthMethods();
  
  console.log('✅ Tests completed');
}

// Export functions for use in other files
export { testRoomAPI, testAuthMethods, runTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}