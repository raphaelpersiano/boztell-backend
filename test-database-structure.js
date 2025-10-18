// Test script untuk memverifikasi database structure dan query
// File: test-database-structure.js

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config.js';

async function testDatabaseStructure() {
  console.log('🔍 Testing Database Structure and Query Flow...\n');
  
  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Test 1: Check table structures
    console.log('1️⃣  Checking table structures...\n');
    
    // Check Leads table
    console.log('📋 Leads Table:');
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, utm_id, leads_status, contact_status, name, phone, outstanding, loan_type')
      .limit(3);
    
    if (leadsError) {
      console.log('⚠️  Leads table structure might be different:', leadsError.message);
    } else {
      console.log('✅ Found leads:', leads.length);
      if (leads.length > 0) {
        console.log('   Sample lead:', leads[0]);
      }
    }

    // Check Rooms table
    console.log('\n🏠 Rooms Table:');
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, leads_id, phone, title, created_at, updated_at')
      .limit(3);
    
    if (roomsError) {
      console.log('⚠️  Rooms table structure might be different:', roomsError.message);
    } else {
      console.log('✅ Found rooms:', rooms.length);
      if (rooms.length > 0) {
        console.log('   Sample room:', rooms[0]);
      }
    }

    // Check Room Participants table
    console.log('\n👥 Room Participants Table:');
    const { data: participants, error: participantsError } = await supabase
      .from('room_participants')
      .select('room_id, user_id, joined_at')
      .limit(3);
    
    if (participantsError) {
      console.log('⚠️  Room participants table structure might be different:', participantsError.message);
    } else {
      console.log('✅ Found participants:', participants.length);
      if (participants.length > 0) {
        console.log('   Sample participant:', participants[0]);
      }
    }

    // Test 2: Test JOIN queries untuk agent
    console.log('\n2️⃣  Testing Agent Query (room_participants → rooms → leads)...\n');
    
    // Cari user_id yang ada di room_participants
    if (participants && participants.length > 0) {
      const testUserId = participants[0].user_id;
      console.log(`🔍 Testing with user_id: ${testUserId}`);
      
      const { data: agentRooms, error: agentError } = await supabase
        .from('room_participants')
        .select(`
          room_id,
          user_id,
          joined_at,
          rooms!inner (
            id,
            leads_id,
            phone,
            title,
            created_at,
            updated_at,
            leads (
              id,
              utm_id,
              leads_status,
              contact_status,
              name,
              phone,
              outstanding,
              loan_type
            )
          )
        `)
        .eq('user_id', testUserId)
        .order('joined_at', { ascending: false });
        
      if (agentError) {
        console.log('❌ Agent query error:', agentError.message);
      } else {
        console.log('✅ Agent query successful');
        console.log(`   Found ${agentRooms.length} rooms for agent`);
        if (agentRooms.length > 0) {
          console.log('   Sample result:', JSON.stringify(agentRooms[0], null, 2));
        }
      }
    } else {
      console.log('⚠️  No participants found, creating sample data for testing...');
      
      // Insert sample data for testing
      await insertSampleData(supabase);
    }

    // Test 3: Test query untuk admin/supervisor (all rooms)
    console.log('\n3️⃣  Testing Admin/Supervisor Query (rooms → leads + participants)...\n');
    
    const { data: allRooms, error: allRoomsError } = await supabase
      .from('rooms')
      .select(`
        id,
        leads_id,
        phone,
        title,
        created_at,
        updated_at,
        leads (
          id,
          utm_id,
          leads_status,
          contact_status,
          name,
          phone,
          outstanding,
          loan_type
        ),
        room_participants (
          user_id,
          joined_at,
          users (
            id,
            name,
            email,
            role
          )
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(3);
      
    if (allRoomsError) {
      console.log('❌ Admin query error:', allRoomsError.message);
    } else {
      console.log('✅ Admin query successful');
      console.log(`   Found ${allRooms.length} total rooms`);
      if (allRooms.length > 0) {
        console.log('   Sample result:', JSON.stringify(allRooms[0], null, 2));
      }
    }

    console.log('\n🎉 Database structure test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function insertSampleData(supabase) {
  console.log('\n📝 Inserting sample data for testing...\n');
  
  try {
    // Insert sample leads
    const { data: sampleLeads, error: leadsError } = await supabase
      .from('leads')
      .upsert([
        {
          id: 'lead-001',
          utm_id: 'utm_001',
          leads_status: 'warm',
          contact_status: 'contacted',
          name: 'John Doe',
          phone: '+628123456789',
          outstanding: 5000000,
          loan_type: 'personal'
        },
        {
          id: 'lead-002', 
          utm_id: 'utm_002',
          leads_status: 'hot',
          contact_status: 'interested',
          name: 'Jane Smith',
          phone: '+628234567890',
          outstanding: 10000000,
          loan_type: 'business'
        }
      ], { onConflict: 'id' })
      .select();
      
    if (leadsError) {
      console.log('❌ Error inserting leads:', leadsError.message);
    } else {
      console.log('✅ Sample leads inserted:', sampleLeads?.length);
    }

    // Insert sample rooms
    const { data: sampleRooms, error: roomsError } = await supabase
      .from('rooms')
      .upsert([
        {
          id: 'room-001',
          leads_id: 'lead-001',
          phone: '+628123456789',
          title: 'Personal'
        },
        {
          id: 'room-002',
          leads_id: 'lead-002', 
          phone: '+628234567890',
          title: 'Business'
        }
      ], { onConflict: 'id' })
      .select();
      
    if (roomsError) {
      console.log('❌ Error inserting rooms:', roomsError.message);
    } else {
      console.log('✅ Sample rooms inserted:', sampleRooms?.length);
    }

    // Insert sample room participants
    const { data: sampleParticipants, error: participantsError } = await supabase
      .from('room_participants')
      .upsert([
        {
          room_id: 'room-001',
          user_id: 'agent-001',
          joined_at: new Date().toISOString()
        },
        {
          room_id: 'room-002',
          user_id: 'agent-001', 
          joined_at: new Date().toISOString()
        },
        {
          room_id: 'room-001',
          user_id: 'supervisor-001',
          joined_at: new Date().toISOString()
        }
      ], { onConflict: 'room_id,user_id' })
      .select();
      
    if (participantsError) {
      console.log('❌ Error inserting participants:', participantsError.message);
    } else {
      console.log('✅ Sample participants inserted:', sampleParticipants?.length);
    }
    
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  }
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabaseStructure().catch(console.error);
}

export { testDatabaseStructure, insertSampleData };