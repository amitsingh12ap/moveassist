-- MoveAssist: Move Plan Migration
-- Agent fills this after on-site visit alongside the quote
-- Run: psql -d moveassist -f move_plan_migration.sql

CREATE TABLE IF NOT EXISTS move_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id             UUID UNIQUE REFERENCES moves(id) ON DELETE CASCADE,
  agent_id            UUID REFERENCES users(id),

  -- Package
  package_type        VARCHAR(30) DEFAULT NULL,
  package_notes       TEXT,

  -- Vehicle
  vehicle_type        VARCHAR(50) DEFAULT NULL,
  vehicle_number      VARCHAR(30) DEFAULT NULL,
  vehicle_count       INTEGER DEFAULT 1,

  -- Movers team
  movers_count        INTEGER DEFAULT 0,
  team_lead_name      VARCHAR(100) DEFAULT NULL,
  team_lead_phone     VARCHAR(20) DEFAULT NULL,

  -- Packing materials
  packing_boxes       INTEGER DEFAULT 0,
  bubble_wrap_meters  INTEGER DEFAULT 0,
  packing_tape_rolls  INTEGER DEFAULT 0,
  stretch_wrap_rolls  INTEGER DEFAULT 0,
  furniture_blankets  INTEGER DEFAULT 0,
  custom_materials    TEXT,

  -- Schedule
  pickup_date         DATE DEFAULT NULL,
  pickup_time_slot    VARCHAR(30) DEFAULT NULL,
  pickup_time_custom  VARCHAR(50) DEFAULT NULL,
  packing_start_time  VARCHAR(50) DEFAULT NULL,
  estimated_delivery  DATE DEFAULT NULL,

  -- Notes
  special_instructions TEXT,
  internal_notes       TEXT,

  -- Meta
  plan_status         VARCHAR(20) DEFAULT 'draft',
  confirmed_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_move_plans_move_id ON move_plans(move_id);

SELECT 'Move plan migration complete' as result;
