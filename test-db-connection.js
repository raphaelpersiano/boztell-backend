// Test script untuk memeriksa database connection dan users table
// File: test-db-connection.js

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config.js';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection and users table...\n');
  
  try {
    // Initialize Supabase client
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Supabase client initialized');
    
    // Test 1: Check if users table exists and get all users
    console.log('\n1️⃣  Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
      
    if (usersError) {
      console.error('❌ Error querying users table:', usersError.message);
      return;
    }
    
    console.log(`✅ Users table found with ${users.length} records`);
    console.log('Users:', users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      pin: u.pin,
      is_active: u.is_active
    })));
    
    // Test 2: Test getUserByPin functionality
    console.log('\n2️⃣  Testing getUserByPin with sample PINs...');
    
    const testPins = [123456, 654321, 111111, 999999];
    
    for (const pin of testPins) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('pin', pin)
        .eq('is_active', true)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`⚠️  PIN ${pin}: No user found`);
        } else {
          console.error(`❌ PIN ${pin}: Error -`, error.message);
        }
      } else {
        console.log(`✅ PIN ${pin}: Found user ${user.name} (${user.role})`);
      }
    }
    
    // Test 3: Check room_participants table
    console.log('\n3️⃣  Checking room_participants table...');
    const { data: participants, error: participantsError } = await supabase
      .from('room_participants')
      .select('*');
      
    if (participantsError) {
      console.log('⚠️  room_participants table might not exist or be empty:', participantsError.message);
    } else {
      console.log(`✅ room_participants table found with ${participants.length} records`);
    }
    
    // Test 4: Check rooms table
    console.log('\n4️⃣  Checking rooms table...');
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*');
      
    if (roomsError) {
      console.log('⚠️  rooms table might not exist or be empty:', roomsError.message);
    } else {
      console.log(`✅ rooms table found with ${rooms.length} records`);
    }
    
    console.log('\n🎉 Database connection test completed!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
  }
}

// Helper function to insert sample users if they don't exist
async function insertSampleUsers() {
  console.log('👤 Inserting sample users...\n');
  
  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const sampleUsers = [
      {
        name: 'Admin User',
        phone: '6281234567890',
        email: 'admin@boztell.com',
        pin: 123456,
        role: 'admin',
        is_active: true
      },
      {
        name: 'Customer Service',
        phone: '6281234567891',
        email: 'cs@boztell.com',
        pin: 654321,
        role: 'supervisor',
        is_active: true
      },
      {
        name: 'Sales Agent',
        phone: '6281234567892',
        email: 'sales@boztell.com',
        pin: 111111,
        role: 'agent',
        is_active: true
      },
      {
        name: 'Manager',
        phone: '6281234567893',
        email: 'manager@boztell.com',
        pin: 999999,
        role: 'supervisor',
        is_active: true
      }
    ];
    
    for (const user of sampleUsers) {
      const { data, error } = await supabase
        .from('users')
        .upsert(user, { onConflict: 'email' })
        .select();
        
      if (error) {
        console.error(`❌ Failed to insert user ${user.email}:`, error.message);
      } else {
        console.log(`✅ User ${user.email} inserted/updated successfully`);
      }
    }
    
    console.log('\n✅ Sample users insertion completed!');
    
  } catch (error) {
    console.error('❌ Failed to insert sample users:', error);
  }
}

// Run tests
async function runDatabaseTests() {
  console.log('🚀 Starting Database Tests');
  console.log('='.repeat(50));
  
  await testDatabaseConnection();
  
  // Uncomment this if you need to insert sample users
  // await insertSampleUsers();
  
  console.log('\n✅ All tests completed');
}

// Export functions for use in other files
export { testDatabaseConnection, insertSampleUsers, runDatabaseTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseTests().catch(console.error);
}