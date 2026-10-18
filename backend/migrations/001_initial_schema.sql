-- GoodWays PostgreSQL / Supabase Initial Schema Migration

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'citizen',
  phone VARCHAR(64),
  department VARCHAR(255),
  badge_number VARCHAR(64),
  designation VARCHAR(255),
  approval_status VARCHAR(32) DEFAULT 'approved',
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
  id VARCHAR(64) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(64) NOT NULL DEFAULT 'Submitted',
  citizen_name VARCHAR(255) NOT NULL,
  citizen_email VARCHAR(255) NOT NULL,
  citizen_description TEXT,
  road_name VARCHAR(255) NOT NULL,
  original_image_url TEXT,
  overall_severity VARCHAR(32) DEFAULT 'medium',
  assigned_department VARCHAR(255),
  priority_score INTEGER DEFAULT 50,
  location JSONB,
  calibration JSONB,
  damage_regions JSONB,
  repair_evidences JSONB,
  audit_trail JSONB,
  verification JSONB
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  path VARCHAR(255) NOT NULL,
  method VARCHAR(16) NOT NULL,
  user_id VARCHAR(64),
  user_email VARCHAR(255),
  user_role VARCHAR(32),
  authorized BOOLEAN NOT NULL,
  event VARCHAR(64) NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_cases_citizen_email ON cases(citizen_email);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
