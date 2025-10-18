-- Enhanced schema for enterprise WhatsApp backend
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id TEXT,
  phone TEXT NOT NULL,
  title TEXT DEFAULT 'Personal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender TEXT,
  content_type TEXT NOT NULL, -- 'text', 'media', 'location', 'contacts', 'interactive', etc.
  content_text TEXT,
  
  -- Media fields
  media_type TEXT, -- 'image', 'video', 'audio', 'document', 'sticker'
  media_id TEXT, -- WhatsApp media ID
  gcs_filename TEXT, -- Google Cloud Storage filename
  gcs_url TEXT, -- Signed URL for access
  file_size BIGINT,
  mime_type TEXT,
  original_filename TEXT,
  
  -- WhatsApp fields
  wa_message_id TEXT,
  status TEXT, -- 'sent', 'delivered', 'read', 'failed'
  status_timestamp TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_media_type ON messages(media_type) WHERE media_type IS NOT NULL;

CREATE TABLE IF NOT EXISTS room_participants (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS devices (
  device_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT, -- 'android', 'ios', 'web'
  app_version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_active ON devices(user_id, is_active);

-- Message status history for analytics
CREATE TABLE IF NOT EXISTS message_status_history (
  id SERIAL PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  recipient_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, status)
);

CREATE INDEX IF NOT EXISTS idx_status_history_message ON message_status_history(message_id);
CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON message_status_history(timestamp);

-- System events logging
CREATE TABLE IF NOT EXISTS system_events (
  id SERIAL PRIMARY KEY,
  room_id TEXT,
  sender_id TEXT,
  event_type TEXT NOT NULL, -- 'customer_changed', 'user_changed', etc.
  description TEXT,
  event_data JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_room ON system_events(room_id);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp);

-- Media files metadata (for tracking uploads)
CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  gcs_filename TEXT NOT NULL UNIQUE,
  original_filename TEXT,
  content_type TEXT,
  file_size BIGINT,
  uploaded_by TEXT,
  room_id TEXT,
  whatsapp_media_id TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'deleted', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_files_room ON media_files(room_id);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_files_wa_media_id ON media_files(whatsapp_media_id) WHERE whatsapp_media_id IS NOT NULL;
