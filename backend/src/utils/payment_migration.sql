-- MoveAssist Payment Gate Migration
-- Run: psql -d moveassist -f payment_migration.sql

-- 1. Update moves table with new status flow + pricing fields
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS amount_total NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);

-- Update existing status column comment (new valid values):
-- created | payment_pending | payment_under_verification | active | in_progress | completed | closed
-- payment_status: pending | partial | under_verification | verified | failed

-- 2. Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id UUID REFERENCES moves(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(5) DEFAULT 'INR',
  payment_mode VARCHAR(50) NOT NULL, -- upi | card | netbanking | cash | agent_cash
  status VARCHAR(50) DEFAULT 'pending', -- pending | success | failed | under_verification
  transaction_id VARCHAR(255),
  gateway_ref VARCHAR(255),
  proof_url TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES users(id), -- agent who recorded cash payment
  verified_by UUID REFERENCES users(id), -- admin who verified
  verified_at TIMESTAMP,
  lock_until TIMESTAMP, -- agent edit lock (10 min after creation)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Move pricing table (simple per-move pricing config)
CREATE TABLE IF NOT EXISTS move_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_id UUID REFERENCES moves(id) ON DELETE CASCADE UNIQUE,
  base_price NUMERIC(10,2) DEFAULT 0,
  distance_km NUMERIC(8,2) DEFAULT 0,
  num_rooms INTEGER DEFAULT 0,
  has_fragile BOOLEAN DEFAULT FALSE,
  fragile_surcharge NUMERIC(10,2) DEFAULT 0,
  floor_surcharge NUMERIC(10,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 18,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Update existing moves to have payment_pending status
UPDATE moves SET status = 'payment_pending' WHERE status = 'planning';

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_payments_move_id ON payments(move_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_moves_payment_status ON moves(payment_status);

SELECT 'Migration complete ✓' as result;
