// Test script to verify all media endpoints are working
import { config } from './src/config.js';

const BASE_URL = 'http://localhost:8080';
const TEST_PHONE = '6287879565390'; // Replace with your test number

async function testEndpoints() {
    console.log('🧪 Testing Media Endpoints...\n');
    
    // Test 1: Upload media endpoint
    console.log('1️⃣ Testing Upload Media endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/messages/upload-media`, {
            method: 'POST'
        });
        console.log(`   Status: ${response.status}`);
        console.log(`   ✅ Endpoint accessible\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Test 2: Send media endpoint  
    console.log('2️⃣ Testing Send Media endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/messages/send-media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: TEST_PHONE,
                type: 'image',
                media: { id: 'test123' }
            })
        });
        console.log(`   Status: ${response.status}`);
        console.log(`   ✅ Endpoint accessible\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Test 3: Upload and send media file endpoint
    console.log('3️⃣ Testing Upload and Send Media File endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/messages/send-media-file`, {
            method: 'POST'
        });
        console.log(`   Status: ${response.status}`);
        console.log(`   ✅ Endpoint accessible\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Test 4: Send text message endpoint
    console.log('4️⃣ Testing Send Text Message endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: TEST_PHONE,
                message: 'Test message'
            })
        });
        console.log(`   Status: ${response.status}`);
        console.log(`   ✅ Endpoint accessible\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    console.log('🎉 All endpoints tested! Use Postman for full functionality testing.');
}

// Run tests
testEndpoints();
