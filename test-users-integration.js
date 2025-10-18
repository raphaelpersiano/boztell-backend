import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3000';
const USERS_URL = `${BASE_URL}/users`;
const AUTH_URL = `${BASE_URL}/api/auth`;

/**
 * Test Users Management System (integrated with Auth)
 */

async function testUsersManagement() {
  console.log('👥 Testing Users Management System\n');

  try {
    // Test 1: Get all users
    console.log('1. Testing get all users...');
    const allUsersResponse = await axios.get(USERS_URL);
    
    console.log('✅ Get all users successful:', {
      success: allUsersResponse.data.success,
      count: allUsersResponse.data.data?.length || 0
    });
    console.log('\n');

    // Test 2: Get users by role
    console.log('2. Testing get users by role (agents)...');
    const agentsResponse = await axios.get(`${USERS_URL}?role=agent`);
    
    console.log('✅ Get agents successful:', {
      success: agentsResponse.data.success,
      count: agentsResponse.data.data?.length || 0
    });
    console.log('\n');

    // Test 3: Get active users only
    console.log('3. Testing get active users...');
    const activeUsersResponse = await axios.get(`${USERS_URL}?is_active=true`);
    
    console.log('✅ Get active users successful:', {
      success: activeUsersResponse.data.success,
      count: activeUsersResponse.data.data?.length || 0
    });
    console.log('\n');

    // Test 4: Create new user via users endpoint
    console.log('4. Testing create user via users endpoint...');
    const newUserData = {
      name: 'User Management Test',
      phone: '6281234567898',
      email: 'usertest@boztell.com',
      pin: '777777',
      role: 'manager',
      is_active: true
    };

    const createUserResponse = await axios.post(USERS_URL, newUserData);
    
    console.log('✅ User created via users endpoint:', {
      success: createUserResponse.data.success,
      user: createUserResponse.data.data?.id ? 'Created with ID' : 'No ID returned'
    });

    const userId = createUserResponse.data.data?.id;
    console.log('\n');

    if (userId) {
      // Test 5: Get single user
      console.log('5. Testing get single user...');
      const singleUserResponse = await axios.get(`${USERS_URL}/${userId}`);
      
      console.log('✅ Get single user successful:', {
        success: singleUserResponse.data.success,
        name: singleUserResponse.data.data?.name,
        role: singleUserResponse.data.data?.role
      });
      console.log('\n');

      // Test 6: Update user
      console.log('6. Testing update user...');
      const updateData = {
        name: 'Updated User Management Test',
        role: 'admin',
        is_active: false
      };

      const updateUserResponse = await axios.put(`${USERS_URL}/${userId}`, updateData);
      
      console.log('✅ User updated successfully:', {
        success: updateUserResponse.data.success,
        name: updateUserResponse.data.data?.name,
        role: updateUserResponse.data.data?.role,
        is_active: updateUserResponse.data.data?.is_active
      });
      console.log('\n');

      // Test 7: Test login with updated user (should fail if is_active = false)
      console.log('7. Testing login with inactive user...');
      try {
        await axios.post(`${AUTH_URL}/login`, {
          identifier: newUserData.email,
          pin: newUserData.pin
        });
      } catch (error) {
        console.log('✅ Inactive user login correctly rejected:', {
          status: error.response?.status || 'No status',
          message: error.response?.data?.message || 'No message'
        });
      }
      console.log('\n');

      // Test 8: Reactivate user
      console.log('8. Testing reactivate user...');
      const reactivateResponse = await axios.put(`${USERS_URL}/${userId}`, {
        is_active: true
      });
      
      console.log('✅ User reactivated:', {
        success: reactivateResponse.data.success,
        is_active: reactivateResponse.data.data?.is_active
      });
      console.log('\n');

      // Test 9: Test login with reactivated user
      console.log('9. Testing login with reactivated user...');
      const loginResponse = await axios.post(`${AUTH_URL}/login`, {
        identifier: newUserData.email,
        pin: newUserData.pin
      });
      
      console.log('✅ Reactivated user login successful:', {
        success: loginResponse.data.success,
        user: loginResponse.data.user?.name
      });
      console.log('\n');

      // Test 10: Delete user
      console.log('10. Testing delete user...');
      const deleteUserResponse = await axios.delete(`${USERS_URL}/${userId}`);
      
      console.log('✅ User deleted successfully:', {
        success: deleteUserResponse.data.success,
        message: deleteUserResponse.data.message
      });
      console.log('\n');
    }

    console.log('🎉 All users management tests passed!');

  } catch (error) {
    console.error('❌ Users management test failed:', {
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
}

/**
 * Test integration between auth and users endpoints
 */
async function testIntegration() {
  console.log('\n🔗 Testing Auth-Users Integration\n');

  try {
    // Test 1: Create user via auth endpoint
    console.log('1. Creating user via auth endpoint...');
    const authUserData = {
      name: 'Auth Created User',
      phone: '6281234567897',
      email: 'authuser@boztell.com',
      pin: '888888',
      role: 'agent'
    };

    const authCreateResponse = await axios.post(`${AUTH_URL}/users`, authUserData);
    const authUserId = authCreateResponse.data.user?.id;
    
    console.log('✅ User created via auth:', {
      success: authCreateResponse.data.success,
      user: authCreateResponse.data.user?.name
    });
    console.log('\n');

    // Test 2: Find same user via users endpoint
    console.log('2. Finding same user via users endpoint...');
    const usersGetResponse = await axios.get(`${USERS_URL}/${authUserId}`);
    
    console.log('✅ Same user found via users endpoint:', {
      success: usersGetResponse.data.success,
      name: usersGetResponse.data.data?.name,
      matches: usersGetResponse.data.data?.id === authUserId
    });
    console.log('\n');

    // Test 3: Update via users endpoint
    console.log('3. Updating via users endpoint...');
    const updateResponse = await axios.put(`${USERS_URL}/${authUserId}`, {
      avatar_url: 'https://example.com/avatar.jpg'
    });
    
    console.log('✅ Updated via users endpoint:', {
      success: updateResponse.data.success,
      avatar_url: updateResponse.data.data?.avatar_url
    });
    console.log('\n');

    // Test 4: Use updated user for message sending
    console.log('4. Testing message with updated user...');
    const messageResponse = await axios.post(`${BASE_URL}/messages/send`, {
      to: '6287879565390',
      text: 'Integration test: Auth and Users working together!',
      user_id: authUserId
    });
    
    console.log('✅ Message sent with integrated user:', {
      success: messageResponse.data.success,
      sender_name: messageResponse.data.sender_name || 'Not returned'
    });
    console.log('\n');

    // Test 5: Get agents list
    console.log('5. Testing agents list...');
    const agentsResponse = await axios.get(`${USERS_URL}/agents/list`);
    
    console.log('✅ Agents list retrieved:', {
      success: agentsResponse.data.success,
      count: agentsResponse.data.data?.length || 0
    });
    console.log('\n');

    // Cleanup
    console.log('6. Cleaning up test user...');
    await axios.delete(`${USERS_URL}/${authUserId}`);
    console.log('✅ Test user cleaned up\n');

    console.log('🎉 All integration tests passed!');

  } catch (error) {
    console.error('❌ Integration test failed:', {
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
}

// Run tests
async function runAllTests() {
  console.clear();
  console.log('🚀 Starting Auth-Users Integration Tests\n');
  console.log('Make sure the server is running on http://localhost:3000\n');
  console.log('='.repeat(60));

  await testUsersManagement();
  await testIntegration();

  console.log('\n' + '='.repeat(60));
  console.log('✨ All tests completed!');
}

runAllTests().catch(console.error);