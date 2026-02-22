-- MoveAssist Database Schema
-- Run: psql -d moveassist -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Move Projects
CREATE TABLE moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  from_address TEXT,
  to_address TEXT,
  move_date DATE,
  status VARCHAR(50) DEFAULT 'planning', -- planning | in_progress | completed
  total_boxes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- QR Boxes
CREATE TABLE boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id UUID REFERENCES moves(id) ON DELETE CASCADE,
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  label VARCHAR(255),
  category VARCHAR(100), -- kitchen, bedroom, electronics, fragile, etc.
  contents TEXT,
  status VARCHAR(50) DEFAULT 'created', -- created | packed | loaded | in_transit | delivered
  qr_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Box Scan Logs
CREATE TABLE box_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  scanned_by UUID REFERENCES users(id),
  location TEXT,
  notes TEXT,
  scanned_at TIMESTAMP DEFAULT NOW()
);

-- Furniture Items
CREATE TABLE furniture_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id UUID REFERENCES moves(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- sofa, bed, table, appliance, etc.
  condition_before VARCHAR(50), -- excellent | good | fair | poor
  condition_after VARCHAR(50),
  damage_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Furniture Photos
CREATE TABLE furniture_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  furniture_id UUID REFERENCES furniture_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(20) DEFAULT 'before', -- before | after
  damage_tagged BOOLEAN DEFAULT FALSE,
  damage_description TEXT,
  taken_at TIMESTAMP DEFAULT NOW()
);

-- Move Reports
CREATE TABLE move_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id UUID REFERENCES moves(id) ON DELETE CASCADE,
  pdf_url TEXT,
  generated_at TIMESTAMP DEFAULT NOW(),
  generation_time_ms INTEGER
);

-- Indexes
CREATE INDEX idx_moves_user_id ON moves(user_id);
CREATE INDEX idx_boxes_move_id ON boxes(move_id);
CREATE INDEX idx_boxes_qr_code ON boxes(qr_code);
CREATE INDEX idx_box_scans_box_id ON box_scans(box_id);
CREATE INDEX idx_furniture_move_id ON furniture_items(move_id);
CREATE INDEX idx_furniture_photos_furniture_id ON furniture_photos(furniture_id);
