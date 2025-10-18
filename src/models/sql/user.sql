-- User table for CRM authentication and management
-- Used for login to CRM system and tracking message senders

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    pin INTEGER NOT NULL CHECK (pin >= 100000 AND pin <= 999999), -- 6 digit PIN
    role VARCHAR(50) NOT NULL DEFAULT 'agent',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample users for testing
INSERT INTO users (name, phone, email, pin, role, is_active) VALUES 
    ('Admin User', '6281234567890', 'admin@boztell.com', 123456, 'admin', true),
    ('Customer Service', '6281234567891', 'cs@boztell.com', 654321, 'agent', true),
    ('Sales Agent', '6281234567892', 'sales@boztell.com', 111111, 'agent', true),
    ('Manager', '6281234567893', 'manager@boztell.com', 999999, 'manager', true)
ON CONFLICT (phone) DO NOTHING;