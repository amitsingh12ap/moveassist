-- Migration 006: missing tables
-- move_activities, disputes, move_documents, move_items

-- ── move_activities ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS move_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id     UUID REFERENCES moves(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role  VARCHAR(20),
  type        VARCHAR(50),
  title       TEXT,
  description TEXT DEFAULT '',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_move_activities_move ON move_activities(move_id);

-- ── disputes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id          UUID REFERENCES moves(id) ON DELETE CASCADE,
  raised_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  furniture_id     UUID REFERENCES furniture_items(id) ON DELETE SET NULL,
  description      TEXT,
  client_photo_url TEXT,
  status           VARCHAR(20) DEFAULT 'open',
  admin_notes      TEXT,
  resolved_at      TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_disputes_move ON disputes(move_id);

-- ── move_documents ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS move_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id       UUID REFERENCES moves(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  name          VARCHAR(255),
  doc_type      VARCHAR(50),
  file_url      TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_move_documents_move ON move_documents(move_id);

-- ── move_items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS move_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id    UUID REFERENCES moves(id) ON DELETE CASCADE,
  name       VARCHAR(255),
  quantity   INTEGER DEFAULT 1,
  category   VARCHAR(100),
  notes      TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_move_items_move ON move_items(move_id);
