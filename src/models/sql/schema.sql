-- Minimal schema suggestion (run manually in Cloud SQL)
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender TEXT,
  content_type TEXT NOT NULL,
  content_text TEXT,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);

CREATE TABLE IF NOT EXISTS room_participants (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  device_token TEXT,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS devices (
  device_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
