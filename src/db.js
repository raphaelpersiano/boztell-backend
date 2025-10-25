import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

// Create Supabase client for database operations
let supabase = null;

function initializeSupabase() {
  if (supabase) return supabase;
  
  if (!config.supabase.url || !config.supabase.serviceKey) {
    throw new Error('Supabase URL and Service Key are required');
  }
  
  supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  logger.info('Supabase client initialized');
  return supabase;
}

// Initialize on module load
initializeSupabase();

// Legacy query function for backward compatibility (use healthCheck() for health checks)
export async function query(text, params) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const sqlUpper = text.trim().toUpperCase();
  
  if (sqlUpper.startsWith('SELECT 1')) {
    // Health check query
    return await healthCheck();
  }
  
  // For other legacy queries, throw error and suggest using Supabase client methods
  throw new Error(`Legacy SQL query not supported: "${text}". Please use Supabase client methods like insertMessage(), updateMessage(), etc.`);
}

export async function withTransaction(fn) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  // Note: Supabase doesn't provide direct transaction control via the JS client
  // For now, we'll execute the function without explicit transaction control
  // In production, you may want to handle transactions at the application level
  // or use Supabase's RPC functions with transaction logic
  
  try {
    // Create a mock client object that mimics the pg client interface
    const mockClient = {
      query: async (text, params) => {
        return await query(text, params);
      }
    };
    
    const result = await fn(mockClient);
    return result;
  } catch (err) {
    logger.error({ err }, 'Transaction failed');
    throw err;
  }
}

function isTransientError(err) {
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('network') ||
    msg.includes('temporary') ||
    msg.includes('retry')
  );
}

// Helper functions for common database operations using Supabase client
export async function insertMessage(messageData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Insert message failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function updateMessage(id, updates) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Update message failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getMessage(id) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get message failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getMessagesByRoom(roomId, limit = 50, offset = 0) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
    
  if (error) {
    throw new Error(`Get messages by room failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

// Health check function
export async function healthCheck() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1);
      
    if (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
    
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  } catch (err) {
    logger.error({ err }, 'Supabase health check failed');
    throw err;
  }
}

// Helper functions for rooms operations
export async function getRoomById(roomId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get room failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getRoomByPhone(phone) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('phone', phone);
    
  if (error) {
    throw new Error(`Get room by phone failed: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  return { rows: data, rowCount: data.length };
}

export async function insertRoom(roomData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  // Ensure room has an ID - fallback to client-generated UUID if not provided by database
  if (!roomData.id) {
    const { v4: uuidv4 } = await import('uuid');
    roomData = { id: uuidv4(), ...roomData };
  }
  
  const { data, error } = await supabase
    .from('rooms')
    .insert(roomData)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Insert room failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function updateRoom(roomId, updates) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('rooms')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Update room failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function deleteRoom(roomId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  // First delete messages
  const { error: messagesError } = await supabase
    .from('messages')
    .delete()
    .eq('room_id', roomId);
    
  if (messagesError) {
    throw new Error(`Delete messages failed: ${messagesError.message}`);
  }
  
  // Then delete room
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId)
    .select();
    
  if (error) {
    throw new Error(`Delete room failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function listRooms(options = {}) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  let query = supabase
    .from('rooms')
    .select(`
      *,
      messages:messages(count)
    `);
    
  if (options.title) {
    query = query.ilike('title', `%${options.title}%`);
  }
  
  query = query.order('created_at', { ascending: false });
  
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`List rooms failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

// Get rooms assigned to specific user (agent)
// Query: room_participants -> LEFT JOIN rooms -> LEFT JOIN leads
export async function getRoomsByUser(userId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
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
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
    
  if (error) {
    throw new Error(`Get rooms by user failed: ${error.message}`);
  }
  
  // Get last message for each room
  const roomIds = data?.map(item => item.rooms.id) || [];
  let lastMessages = {};
  
  if (roomIds.length > 0) {
    // Get the latest message for each room
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('room_id, content_text, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false });
    
    if (!messagesError && messagesData) {
      // Group by room_id and get the first (latest) message for each room
      messagesData.forEach(msg => {
        if (!lastMessages[msg.room_id]) {
          lastMessages[msg.room_id] = {
            content_text: msg.content_text,
            created_at: msg.created_at
          };
        }
      });
    }
  }
  
  // Transform data structure untuk response yang clean
  const transformedData = data?.map(item => ({
    room_id: item.rooms.id,
    room_phone: item.rooms.phone,
    room_title: item.rooms.title,
    room_created_at: item.rooms.created_at,
    room_updated_at: item.rooms.updated_at,
    participant_joined_at: item.joined_at,
    last_message: lastMessages[item.rooms.id]?.content_text || null,
    last_message_at: lastMessages[item.rooms.id]?.created_at || null,
    is_assigned: true, // Always true for getRoomsByUser (user is participant)
    leads_info: item.rooms.leads ? {
      id: item.rooms.leads.id,
      utm_id: item.rooms.leads.utm_id,
      leads_status: item.rooms.leads.leads_status,
      contact_status: item.rooms.leads.contact_status,
      name: item.rooms.leads.name,
      phone: item.rooms.leads.phone,
      outstanding: item.rooms.leads.outstanding,
      loan_type: item.rooms.leads.loan_type
    } : null
  })) || [];
  
  return { rows: transformedData, rowCount: transformedData.length };
}

// Get all rooms with participants and leads (for admin/supervisor)
// Query: rooms -> LEFT JOIN leads -> LEFT JOIN room_participants -> LEFT JOIN users
export async function getAllRoomsWithDetails() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
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
    .order('updated_at', { ascending: false });
    
  if (error) {
    throw new Error(`Get all rooms with details failed: ${error.message}`);
  }
  
  // Debug log to check room_participants structure
  if (data && data.length > 0) {
    const sampleRoom = data[0];
    logger.debug({ 
      sample_room_id: sampleRoom.id,
      room_participants_type: typeof sampleRoom.room_participants,
      room_participants_is_array: Array.isArray(sampleRoom.room_participants),
      room_participants_value: sampleRoom.room_participants,
      room_participants_length: sampleRoom.room_participants?.length
    }, 'Debug: room_participants structure in getAllRoomsWithDetails');
  }
  
  // Get last message for each room
  const roomIds = data?.map(room => room.id) || [];
  let lastMessages = {};
  
  if (roomIds.length > 0) {
    // Get the latest message for each room
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('room_id, content_text, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false });
    
    if (!messagesError && messagesData) {
      // Group by room_id and get the first (latest) message for each room
      messagesData.forEach(msg => {
        if (!lastMessages[msg.room_id]) {
          lastMessages[msg.room_id] = {
            content_text: msg.content_text,
            created_at: msg.created_at
          };
        }
      });
    }
  }
  
  // Transform untuk response yang consistent dengan getRoomsByUser
  const transformedData = data?.map(room => {
    // Ensure room_participants is always an array
    let participantsArray = room.room_participants;
    
    // Handle different data types from Supabase
    if (!participantsArray) {
      participantsArray = [];
    } else if (!Array.isArray(participantsArray)) {
      // If it's an object, wrap it in array
      participantsArray = [participantsArray];
    }
    
    const isAssigned = participantsArray.length > 0;
    
    return {
      room_id: room.id,
      room_phone: room.phone,
      room_title: room.title,
      room_created_at: room.created_at,
      room_updated_at: room.updated_at,
      last_message: lastMessages[room.id]?.content_text || null,
      last_message_at: lastMessages[room.id]?.created_at || null,
      is_assigned: isAssigned,
      leads_info: room.leads ? {
        id: room.leads.id,
        utm_id: room.leads.utm_id,
        leads_status: room.leads.leads_status,
        contact_status: room.leads.contact_status,
        name: room.leads.name,
        phone: room.leads.phone,
        outstanding: room.leads.outstanding,
        loan_type: room.leads.loan_type
      } : null,
      participants: participantsArray.map(participant => ({
        user_id: participant.user_id,
        joined_at: participant.joined_at,
        user_info: participant.users ? {
          id: participant.users.id,
          name: participant.users.name,
          email: participant.users.email,
          role: participant.users.role
        } : null
      }))
    };
  }) || [];
  
  return { rows: transformedData, rowCount: transformedData.length };
}

// Helper functions for participants and devices (for FCM notifications)
export async function getRoomParticipants(roomId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      user_id,
      devices!inner(device_token)
    `)
    .eq('room_id', roomId)
    .not('devices.device_token', 'is', null);
    
  if (error) {
    throw new Error(`Get room participants failed: ${error.message}`);
  }
  
  // Flatten the structure to match the original SQL query
  const participants = data?.map(participant => ({
    user_id: participant.user_id,
    device_token: participant.devices.device_token
  })) || [];
  
  return { rows: participants, rowCount: participants.length };
}

export async function deleteDeviceTokens(tokens) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  if (!tokens || tokens.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  const { data, error } = await supabase
    .from('devices')
    .delete()
    .in('device_token', tokens)
    .select();
    
  if (error) {
    throw new Error(`Delete device tokens failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

// Helper functions for system events
export async function insertSystemEvent(eventData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('system_events')
    .insert({
      ...eventData,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Insert system event failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getSystemEvents(roomId, limit = 50) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('system_events')
    .select('*')
    .eq('room_id', roomId)
    .order('timestamp', { ascending: false })
    .limit(limit);
    
  if (error) {
    throw new Error(`Get system events failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

// Helper functions for message status operations
export async function updateMessageStatus(waMessageId, status, timestamp) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .update({
      status,
      status_timestamp: timestamp,
      updated_at: new Date().toISOString()
    })
    .eq('wa_message_id', waMessageId)
    .select('id, room_id');
    
  if (error) {
    throw new Error(`Update message status failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function insertStatusHistory(statusData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('message_status_history')
    .insert({
      ...statusData,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    // Use upsert behavior - ignore conflicts
    if (error.code === '23505') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Insert status history failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getMessageByWaId(waMessageId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .select('room_id')
    .eq('wa_message_id', waMessageId)
    .limit(1)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get message by WhatsApp ID failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getMessageStats(roomId, limit = 100) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  // Get messages from the last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data, error } = await supabase
    .from('messages')
    .select('status')
    .eq('room_id', roomId)
    .not('wa_message_id', 'is', null)
    .gte('created_at', yesterday.toISOString())
    .limit(limit);
    
  if (error) {
    throw new Error(`Get message stats failed: ${error.message}`);
  }
  
  // Calculate statistics
  const total_messages = data?.length || 0;
  const sent_count = data?.filter(m => m.status === 'sent').length || 0;
  const delivered_count = data?.filter(m => m.status === 'delivered').length || 0;
  const read_count = data?.filter(m => m.status === 'read').length || 0;
  const failed_count = data?.filter(m => m.status === 'failed').length || 0;
  
  const stats = {
    total_messages,
    sent_count,
    delivered_count,
    read_count,
    failed_count
  };
  
  return { rows: [stats], rowCount: 1 };
}

// Helper functions for device management
export async function upsertDevice(userId, deviceToken, platform) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('devices')
    .upsert({
      user_id: userId,
      device_token: deviceToken,
      platform: platform || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'device_token'
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Upsert device failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

// Helper functions for leads management
export async function getLeads(filters = {}) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  let query = supabase
    .from('leads')
    .select('*');
    
  // Apply filters
  if (filters.leads_status) {
    query = query.eq('leads_status', filters.leads_status);
  }
  
  if (filters.contact_status) {
    query = query.eq('contact_status', filters.contact_status);
  }
  
  if (filters.loan_type) {
    query = query.eq('loan_type', filters.loan_type);
  }
  
  if (filters.utm_id) {
    query = query.eq('utm_id', filters.utm_id);
  }
  
  if (filters.phone) {
    query = query.eq('phone', filters.phone);
  }
  
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }
  
  // Apply ordering
  query = query.order('created_at', { ascending: false });
  
  // Apply pagination
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Get leads failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0, totalCount: count };
}

export async function getLeadsCount(filters = {}) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
    
  // Apply same filters as getLeads
  if (filters.leads_status) {
    query = query.eq('leads_status', filters.leads_status);
  }
  
  if (filters.contact_status) {
    query = query.eq('contact_status', filters.contact_status);
  }
  
  if (filters.loan_type) {
    query = query.eq('loan_type', filters.loan_type);
  }
  
  if (filters.utm_id) {
    query = query.eq('utm_id', filters.utm_id);
  }
  
  if (filters.phone) {
    query = query.eq('phone', filters.phone);
  }
  
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }
  
  const { count, error } = await query;
  
  if (error) {
    throw new Error(`Get leads count failed: ${error.message}`);
  }
  
  return { rows: [{ count }], rowCount: 1 };
}

export async function getLeadById(id) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get lead by ID failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function insertLead(leadData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...leadData,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Insert lead failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function updateLead(id, updates) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('leads')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Update lead failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function deleteLead(id) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .select();
    
  if (error) {
    throw new Error(`Delete lead failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function getLeadsStats() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('leads')
    .select('leads_status, outstanding');
    
  if (error) {
    throw new Error(`Get leads stats failed: ${error.message}`);
  }
  
  // Group and calculate stats
  const statsMap = {};
  
  data?.forEach(lead => {
    const status = lead.leads_status;
    if (!statsMap[status]) {
      statsMap[status] = { count: 0, total_amount: 0 };
    }
    statsMap[status].count++;
    statsMap[status].total_amount += lead.outstanding || 0;
  });
  
  // Convert to array format and sort
  const statusOrder = ['cold', 'warm', 'hot', 'paid', 'service', 'repayment', 'advocate'];
  const stats = statusOrder
    .filter(status => statsMap[status])
    .map(status => ({
      leads_status: status,
      count: statsMap[status].count,
      total_amount: statsMap[status].total_amount
    }));
  
  // Add any other statuses not in the predefined order
  Object.keys(statsMap).forEach(status => {
    if (!statusOrder.includes(status)) {
      stats.push({
        leads_status: status,
        count: statsMap[status].count,
        total_amount: statsMap[status].total_amount
      });
    }
  });
  
  return { rows: stats, rowCount: stats.length };
}

// Get leads assigned to a specific user (for agent role)
// Join: room_participants -> rooms -> leads
export async function getLeadsByAssignedUser(userId, filters = {}) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  // First, get all room_ids where user is participant
  const { data: participantData, error: participantError } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId);
    
  if (participantError) {
    throw new Error(`Get room participants failed: ${participantError.message}`);
  }
  
  const roomIds = participantData?.map(p => p.room_id) || [];
  
  if (roomIds.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  // Get leads_id from rooms
  const { data: roomsData, error: roomsError } = await supabase
    .from('rooms')
    .select('leads_id')
    .in('id', roomIds)
    .not('leads_id', 'is', null);
    
  if (roomsError) {
    throw new Error(`Get rooms failed: ${roomsError.message}`);
  }
  
  const leadsIds = roomsData?.map(r => r.leads_id) || [];
  
  if (leadsIds.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  // Get leads with filters
  let query = supabase
    .from('leads')
    .select('*')
    .in('id', leadsIds);
    
  // Apply filters (same as getLeads)
  if (filters.leads_status) {
    query = query.eq('leads_status', filters.leads_status);
  }
  
  if (filters.contact_status) {
    query = query.eq('contact_status', filters.contact_status);
  }
  
  if (filters.loan_type) {
    query = query.eq('loan_type', filters.loan_type);
  }
  
  if (filters.utm_id) {
    query = query.eq('utm_id', filters.utm_id);
  }
  
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }
  
  query = query.order('created_at', { ascending: false });
  
  // Apply pagination
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Get assigned leads failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

// Helper functions for media message operations
export async function getMediaMessage(messageId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .select('*, gcs_url as current_url')
    .eq('id', messageId)
    .eq('content_type', 'media')
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Get media message failed: ${error.message}`);
  }
  
  return data;
}

export async function updateMediaUrl(messageId, newUrl) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .update({
      gcs_url: newUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Update media URL failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

// Helper functions for user management
export async function getUsers(filters = {}) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  let query = supabase.from('users').select('*');
  
  if (filters.role) {
    query = query.eq('role', filters.role);
  }
  
  if (filters.email) {
    query = query.eq('email', filters.email);
  }
  
  if (filters.phone) {
    query = query.eq('phone', filters.phone);
  }
  
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  
  // Legacy support for 'active' filter
  if (filters.active !== undefined && filters.active !== 'all') {
    const isActive = filters.active === 'true';
    query = query.eq('is_active', isActive);
  }
  
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Get users failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function getUserById(id) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get user by ID failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function getUserByPin(pin) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('pin', parseInt(pin))
    .eq('is_active', true)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get user by PIN failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function insertUser(userData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('users')
    .insert({
      ...userData,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Insert user failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function updateUser(id, updates) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Update user failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function deleteUser(id) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)
    .select();
    
  if (error) {
    throw new Error(`Delete user failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function getAgents() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'agent')
    .eq('is_active', true)
    .order('name', { ascending: true });
    
  if (error) {
    throw new Error(`Get agents failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

// Room participants management functions
export async function addRoomParticipant(participantData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('room_participants')
    .insert({
      room_id: participantData.room_id,
      user_id: participantData.user_id,
      joined_at: participantData.joined_at || new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Add room participant failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

export async function removeRoomParticipant(roomId, userId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .select();
    
  if (error) {
    throw new Error(`Remove room participant failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function removeRoomParticipantById(participantId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('room_participants')
    .delete()
    .eq('id', participantId)
    .select();
    
  if (error) {
    throw new Error(`Remove room participant by ID failed: ${error.message}`);
  }
  
  return { rows: data || [], rowCount: data?.length || 0 };
}

export async function getRoomParticipantsWithUsers(roomId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      user_id,
      joined_at,
      users!inner (
        id,
        name,
        email,
        role
      )
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
    
  if (error) {
    throw new Error(`Get room participants with users failed: ${error.message}`);
  }
  
  // Transform data structure for clean response
  const transformedData = data?.map(participant => ({
    user_id: participant.user_id,
    joined_at: participant.joined_at,
    user_name: participant.users.name,
    user_email: participant.users.email,
    user_role: participant.users.role
  })) || [];
  
  return { rows: transformedData, rowCount: transformedData.length };
}

export async function checkRoomParticipant(roomId, userId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('room_participants')
    .select('room_id, user_id, joined_at')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Check room participant failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

// Helper function to get leads by phone number
export async function getLeadByPhone(phone) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Get lead by phone failed: ${error.message}`);
  }
  
  return { rows: [data], rowCount: 1 };
}

// Get leads assigned to specific user through room participants
export async function getLeadsByUserId(userId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  // Step 1: Get room_ids for the user from room_participants
  const { data: roomParticipants, error: participantsError } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId);
    
  if (participantsError) {
    throw new Error(`Get room participants failed: ${participantsError.message}`);
  }
  
  if (!roomParticipants || roomParticipants.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  // Extract room_ids
  const roomIds = roomParticipants.map(rp => rp.room_id);
  
  // Step 2: Get leads_ids from rooms table based on room_ids
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('leads_id')
    .in('id', roomIds)
    .not('leads_id', 'is', null);
    
  if (roomsError) {
    throw new Error(`Get rooms failed: ${roomsError.message}`);
  }
  
  if (!rooms || rooms.length === 0) {
    return { rows: [], rowCount: 0 };
  }
  
  // Extract leads_ids (remove duplicates)
  const leadsIds = [...new Set(rooms.map(room => room.leads_id))];
  
  // Step 3: Get leads data based on leads_ids
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .in('id', leadsIds)
    .order('created_at', { ascending: false });
    
  if (leadsError) {
    throw new Error(`Get leads failed: ${leadsError.message}`);
  }
  
  return { rows: leads || [], rowCount: leads?.length || 0 };
}

// Export supabase client for direct access when needed
export { supabase };

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
