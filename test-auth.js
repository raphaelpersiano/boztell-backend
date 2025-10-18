import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/auth`;

/**
 * Test Authentication System
 * Tests user authentication with PIN-based login for CRM
 */

async function testAuthentication() {
  console.log('🔐 Testing Authentication System\n');

  try {
    // Test 1: Login with valid credentials
    console.log('1. Testing valid login...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      identifier: 'admin@boztell.com', // or use phone: '6281234567890'
      pin: '123456'
    });
    
    console.log('✅ Login successful:', {
      success: loginResponse.data.success,
      user: loginResponse.data.user
    });
    
    const userId = loginResponse.data.user.id;
    console.log('\n');

    // Test 2: Get user for message lookup
    console.log('2. Testing user lookup for messaging...');
    const userResponse = await axios.get(`${API_URL}/user/${userId}`);
    
    console.log('✅ User lookup successful:', {
      success: userResponse.data.success,
      user: userResponse.data.user
    });
    console.log('\n');

    // Test 3: Validate session
    console.log('3. Testing session validation...');
    const sessionResponse = await axios.post(`${API_URL}/validate-session`, {
      userId: userId
    });
    
    console.log('✅ Session validation successful:', {
      success: sessionResponse.data.success,
      user: sessionResponse.data.user
    });
    console.log('\n');

    // Test 4: Get all users (admin)
    console.log('4. Testing get all users...');
    const usersResponse = await axios.get(`${API_URL}/users`);
    
    console.log('✅ Get all users successful:', {
      success: usersResponse.data.success,
      count: usersResponse.data.users?.length || 0
    });
    console.log('\n');

    // Test 5: Test invalid login
    console.log('5. Testing invalid login...');
    try {
      await axios.post(`${API_URL}/login`, {
        identifier: 'admin@boztell.com',
        pin: '000000' // Wrong PIN
      });
    } catch (error) {
      console.log('✅ Invalid login correctly rejected:', {
        status: error.response.status,
        message: error.response.data.message
      });
    }
    console.log('\n');

    // Test 6: Test user not found
    console.log('6. Testing user not found...');
    try {
      await axios.post(`${API_URL}/login`, {
        identifier: 'notfound@boztell.com',
        pin: '123456'
      });
    } catch (error) {
      console.log('✅ User not found correctly handled:', {
        status: error.response.status,
        message: error.response.data.message
      });
    }
    console.log('\n');

    console.log('🎉 All authentication tests passed!');

  } catch (error) {
    console.error('❌ Authentication test failed:', {
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
}

/**
 * Test message sending with user authentication
 */
async function testMessageWithAuth() {
  console.log('\n📱 Testing Message Sending with User Authentication\n');

  try {
    // First login to get user ID
    const loginResponse = await axios.post(`${API_URL}/login`, {
      identifier: 'admin@boztell.com',
      pin: '123456'
    });
    
    const userId = loginResponse.data.user.id;
    console.log('🔐 Logged in as:', loginResponse.data.user.name);

    // Test sending message with user_id (should lookup sender name from user table)
    console.log('\n1. Testing message with user_id...');
    const messageResponse = await axios.post(`${BASE_URL}/messages/send`, {
      to: '6287879565390', // Test number
      text: 'Hello from authenticated user! This message was sent using user authentication system.',
      user_id: userId // This should lookup sender_name from user table
    });
    
    console.log('✅ Message sent with authentication:', {
      success: messageResponse.data.success,
      to: messageResponse.data.to,
      sender_name: messageResponse.data.sender_name || 'Not returned',
      message_id: messageResponse.data.message_id
    });
    console.log('\n');

    // Test sending message with fallback (no user_id)
    console.log('2. Testing message with fallback...');
    const fallbackResponse = await axios.post(`${BASE_URL}/messages/send`, {
      to: '6287879565390', 
      text: 'Hello with fallback sender name!',
      sender_name: 'Custom Operator' // This will be used as fallback
    });
    
    console.log('✅ Message sent with fallback:', {
      success: fallbackResponse.data.success,
      to: fallbackResponse.data.to,
      message_id: fallbackResponse.data.message_id
    });
    console.log('\n');

    console.log('🎉 All message authentication tests passed!');

  } catch (error) {
    console.error('❌ Message authentication test failed:', {
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
}

/**
 * Test user creation (admin function)
 */
async function testUserCreation() {
  console.log('\n👤 Testing User Creation\n');

  try {
    const newUser = {
      name: 'Test Agent',
      phone: '6281234567899',
      email: 'test.agent@boztell.com',
      pin: '555555',
      role: 'agent',
      is_active: true
    };

    console.log('1. Creating new user...');
    const createResponse = await axios.post(`${API_URL}/users`, newUser);
    
    console.log('✅ User created successfully:', {
      success: createResponse.data.success,
      user: createResponse.data.user
    });

    // Test login with new user
    console.log('\n2. Testing login with new user...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      identifier: newUser.email,
      pin: newUser.pin
    });
    
    console.log('✅ New user login successful:', {
      success: loginResponse.data.success,
      user: loginResponse.data.user.name
    });

    console.log('\n🎉 User creation tests passed!');

  } catch (error) {
    console.error('❌ User creation test failed:', {
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
}

// Run tests
async function runAllTests() {
  console.clear();
  console.log('🚀 Starting Authentication System Tests\n');
  console.log('Make sure the server is running on http://localhost:3000\n');
  console.log('='.repeat(60));

  await testAuthentication();
  await testMessageWithAuth();
  await testUserCreation();

  console.log('\n' + '='.repeat(60));
  console.log('✨ All tests completed!');
}

runAllTests().catch(console.error);