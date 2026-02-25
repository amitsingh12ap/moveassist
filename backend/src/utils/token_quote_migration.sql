-- MoveAssist: Token Payment + Agent Quote Flow Migration
-- Run: psql -d moveassist -f token_quote_migration.sql

-- 1. Add token & quote tracking columns to moves
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS token_amount      NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_paid        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS token_paid_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS estimated_cost    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount      NUMERIC(10,2) DEFAULT 0,
  -- quote_status: null | submitted (no customer approval step)
  ADD COLUMN IF NOT EXISTS quote_status      VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bhk_type          VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS floor_from        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS floor_to          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_lift_from     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_lift_to       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS from_city         VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS to_city           VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS from_lat          NUMERIC(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS from_lng          NUMERIC(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS to_lat            NUMERIC(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS to_lng            NUMERIC(10,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rated             BOOLEAN DEFAULT FALSE;

-- 2. Agent Quote table
--    Agent submits on-site estimation → final_amount updates on moves.
--    No customer approval — balance is auto-calculated.
CREATE TABLE IF NOT EXISTS agent_quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id         UUID REFERENCES moves(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES users(id),
  base_price      NUMERIC(10,2) NOT NULL,
  floor_charge    NUMERIC(10,2) DEFAULT 0,
  fragile_charge  NUMERIC(10,2) DEFAULT 0,
  extra_items     NUMERIC(10,2) DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  subtotal        NUMERIC(10,2) NOT NULL,
  tax             NUMERIC(10,2) NOT NULL,
  total           NUMERIC(10,2) NOT NULL,
  notes           TEXT,
  items_snapshot  JSONB,
  submitted_at    TIMESTAMP DEFAULT NOW()
);

-- 3. Payments: add payment_type + verified_at columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type  VARCHAR(30) DEFAULT 'balance',
  ADD COLUMN IF NOT EXISTS verified_by   UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at   TIMESTAMP;
  -- payment_type: token | balance | full

-- 4. move_pricing table (admin sets confirmed price before token payment)
CREATE TABLE IF NOT EXISTS move_pricing (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id           UUID UNIQUE REFERENCES moves(id) ON DELETE CASCADE,
  base_price        NUMERIC(10,2) NOT NULL,
  fragile_surcharge NUMERIC(10,2) DEFAULT 0,
  floor_surcharge   NUMERIC(10,2) DEFAULT 0,
  discount          NUMERIC(10,2) DEFAULT 0,
  tax_percent       INTEGER DEFAULT 18,
  total             NUMERIC(10,2) NOT NULL,
  set_by            UUID REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- 5. move_ratings table
CREATE TABLE IF NOT EXISTS move_ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id     UUID REFERENCES moves(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review      TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_agent_quotes_move_id ON agent_quotes(move_id);
CREATE INDEX IF NOT EXISTS idx_moves_quote_status   ON moves(quote_status);
CREATE INDEX IF NOT EXISTS idx_moves_token_paid     ON moves(token_paid);
CREATE INDEX IF NOT EXISTS idx_payments_type        ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_move_pricing_move    ON move_pricing(move_id);

-- ── Move status flow: ──────────────────────────────────────────
--   created → payment_pending → payment_under_verification
--   → active → in_progress → completed → closed
-- ── Payment status flow: ──────────────────────────────────────
--   pending → under_verification → token_verified → fully_paid
--   (or: failed)
-- ── Quote status values: ──────────────────────────────────────
--   null (not yet submitted) → submitted

SELECT 'Token/Quote migration complete ✓' as result;
