-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama_lengkap TEXT NOT NULL,
  nomor_telpon VARCHAR(20) NOT NULL,
  nominal_pinjaman INTEGER NOT NULL DEFAULT 0,
  jenis_utang VARCHAR(100) NOT NULL,
  leads_status TEXT NOT NULL DEFAULT 'cold' 
    CHECK (leads_status IN ('cold', 'warm', 'hot', 'paid', 'service', 'repayment', 'advocate')),
  assigned_agent_id TEXT,
  assigned_agent_name TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(nomor_telpon);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(leads_status);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(nama_lengkap);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

-- Create users table for CRM users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' 
    CHECK (role IN ('admin', 'supervisor', 'agent')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Add room assignment fields to existing rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS assignment_timestamp TIMESTAMPTZ;

-- Create indexes for room assignments
CREATE INDEX IF NOT EXISTS idx_rooms_lead ON rooms(lead_id);
CREATE INDEX IF NOT EXISTS idx_rooms_agent ON rooms(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_rooms_assigned ON rooms(is_assigned);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password should be hashed in real application)
INSERT INTO users (id, email, name, role) 
VALUES ('admin-001', 'admin@boztell.com', 'Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample supervisor user
INSERT INTO users (id, email, name, role) 
VALUES ('supervisor-001', 'supervisor@boztell.com', 'Supervisor', 'supervisor')
ON CONFLICT (email) DO NOTHING;

-- Insert sample agent users
INSERT INTO users (id, email, name, role) 
VALUES 
  ('agent-001', 'agent1@boztell.com', 'Agent 1', 'agent'),
  ('agent-002', 'agent2@boztell.com', 'Agent 2', 'agent'),
  ('agent-003', 'agent3@boztell.com', 'Agent 3', 'agent')
ON CONFLICT (email) DO NOTHING;