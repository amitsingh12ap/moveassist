-- Feature Flags Table Setup
-- Run this script to enable/disable intercity move restrictions

-- Create feature_flags table if it doesn't exist
CREATE TABLE IF NOT EXISTS feature_flags (
  key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert or update the intra_city_only flag
INSERT INTO feature_flags (key, enabled, description)
VALUES (
  'intra_city_only',
  false,  -- Set to 'true' to restrict intercity moves, 'false' to allow all moves
  'When enabled, only allows moves within the same city. Blocks intercity moves.'
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = CURRENT_TIMESTAMP;

-- View current feature flags
SELECT * FROM feature_flags;

-- To enable intercity restriction:
-- UPDATE feature_flags SET enabled = true WHERE key = 'intra_city_only';

-- To disable intercity restriction (allow all moves):
-- UPDATE feature_flags SET enabled = false WHERE key = 'intra_city_only';
