-- Agent Auto-Assignment Schema
-- This table stores agent availability, location, and performance data

-- Create user_profiles table (if not exists)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city VARCHAR(255),                           -- Agent's base city
  last_known_lat DECIMAL(10, 8),              -- Last known latitude
  last_known_lng DECIMAL(11, 8),              -- Last known longitude
  is_available BOOLEAN DEFAULT true,          -- Agent availability status
  rating DECIMAL(3, 2) DEFAULT 4.5,           -- Agent rating (0.00 to 5.00)
  total_moves_completed INTEGER DEFAULT 0,    -- Number of moves completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster city-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_city ON user_profiles(city);
CREATE INDEX IF NOT EXISTS idx_user_profiles_available ON user_profiles(is_available);

-- Sample data for testing (Test Agent)
-- Update existing agent or create profile if needed
INSERT INTO user_profiles (user_id, city, last_known_lat, last_known_lng, is_available, rating)
SELECT id, 'Mumbai', 19.0760, 72.8777, true, 4.8
FROM users 
WHERE email = 'testagent@moveassist.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  city = EXCLUDED.city,
  last_known_lat = EXCLUDED.last_known_lat,
  last_known_lng = EXCLUDED.last_known_lng,
  is_available = EXCLUDED.is_available,
  rating = EXCLUDED.rating,
  updated_at = CURRENT_TIMESTAMP;

-- View current agent profiles
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  up.city,
  up.is_available,
  up.rating,
  up.total_moves_completed
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE u.role = 'agent'
ORDER BY up.rating DESC NULLS LAST;

-- How to update agent location (can be called from mobile app):
-- UPDATE user_profiles 
-- SET last_known_lat = 19.1234, last_known_lng = 72.5678, updated_at = CURRENT_TIMESTAMP 
-- WHERE user_id = 'agent-uuid';

-- How to toggle agent availability:
-- UPDATE user_profiles 
-- SET is_available = false, updated_at = CURRENT_TIMESTAMP 
-- WHERE user_id = 'agent-uuid';

-- How to update rating after move completion:
-- UPDATE user_profiles 
-- SET rating = (rating * total_moves_completed + new_rating) / (total_moves_completed + 1),
--     total_moves_completed = total_moves_completed + 1,
--     updated_at = CURRENT_TIMESTAMP
-- WHERE user_id = 'agent-uuid';
