-- ========================================
-- MOVEASSIST PRICING SYSTEM SCHEMA
-- Admin-Driven Flexible Pricing Configuration
-- Based on Market Research 2025-26
-- ========================================

-- 1. PRICING CONFIGURATIONS TABLE
-- Allows admin to set pricing models per city/region
CREATE TABLE IF NOT EXISTS pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  config_name VARCHAR(100) NOT NULL,
  city VARCHAR(100),                    -- NULL = default/national
  is_default BOOLEAN DEFAULT false,     -- Default pricing model
  is_active BOOLEAN DEFAULT true,
  
  -- Base Pricing by BHK Type (in INR)
  base_1bhk DECIMAL(10,2) DEFAULT 5500,
  base_2bhk DECIMAL(10,2) DEFAULT 10000,
  base_3bhk DECIMAL(10,2) DEFAULT 16000,
  base_4bhk DECIMAL(10,2) DEFAULT 21000,
  base_5bhk DECIMAL(10,2) DEFAULT 28000,
  
  -- Distance-based Charges (per km)
  rate_per_km_local DECIMAL(10,2) DEFAULT 12,      -- 0-50 km
  rate_per_km_regional DECIMAL(10,2) DEFAULT 20,   -- 50-200 km
  rate_per_km_intercity DECIMAL(10,2) DEFAULT 15,  -- 200+ km
  
  -- Additional Charges
  floor_charge_no_lift DECIMAL(10,2) DEFAULT 400,  -- Per floor
  floor_charge_with_lift DECIMAL(10,2) DEFAULT 0,  -- Usually free
  
  -- Packing & Materials (% of base)
  packing_material_percent DECIMAL(5,2) DEFAULT 25, -- 25% of base
  
  -- Fragile Items Surcharge (%)
  fragile_items_percent DECIMAL(5,2) DEFAULT 5,     -- 5% extra
  
  -- Labor Costs
  labor_cost_per_person DECIMAL(10,2) DEFAULT 700,
  default_labor_count INTEGER DEFAULT 3,
  
  -- Insurance (% of estimated value)
  insurance_percent DECIMAL(5,2) DEFAULT 0.5,
  
  -- Tax
  gst_percent DECIMAL(5,2) DEFAULT 18,
  
  -- Distance Thresholds (km)
  local_distance_max DECIMAL(10,2) DEFAULT 50,
  regional_distance_max DECIMAL(10,2) DEFAULT 200,
  
  -- Margin & Adjustments
  profit_margin_percent DECIMAL(5,2) DEFAULT 0,     -- Admin can add margin
  seasonal_adjustment_percent DECIMAL(5,2) DEFAULT 0, -- Peak season pricing
  
  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pricing_configs_city ON pricing_configs(city);
CREATE INDEX IF NOT EXISTS idx_pricing_configs_active ON pricing_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_configs_default ON pricing_configs(is_default);

-- 2. PRICING OVERRIDES TABLE
-- Allows admin to set custom pricing for specific routes or scenarios
CREATE TABLE IF NOT EXISTS pricing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Route Specification
  from_city VARCHAR(100),
  to_city VARCHAR(100),
  
  -- Or Distance Range
  distance_min DECIMAL(10,2),
  distance_max DECIMAL(10,2),
  
  -- Override Values (NULL = use config default)
  override_1bhk DECIMAL(10,2),
  override_2bhk DECIMAL(10,2),
  override_3bhk DECIMAL(10,2),
  override_4bhk DECIMAL(10,2),
  override_5bhk DECIMAL(10,2),
  
  override_rate_per_km DECIMAL(10,2),
  
  -- Metadata
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_overrides_cities ON pricing_overrides(from_city, to_city);

-- 3. MOVE ESTIMATES TABLE
-- Stores calculated estimates for each move
CREATE TABLE IF NOT EXISTS move_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID UNIQUE REFERENCES moves(id) ON DELETE CASCADE,
  
  -- Pricing Config Used
  config_id UUID REFERENCES pricing_configs(id),
  
  -- Calculation Breakdown
  base_amount DECIMAL(10,2) NOT NULL,
  distance_km DECIMAL(10,2),
  distance_charges DECIMAL(10,2) DEFAULT 0,
  floor_charges DECIMAL(10,2) DEFAULT 0,
  packing_charges DECIMAL(10,2) DEFAULT 0,
  labor_charges DECIMAL(10,2) DEFAULT 0,
  fragile_charges DECIMAL(10,2) DEFAULT 0,
  insurance_charges DECIMAL(10,2) DEFAULT 0,
  
  -- Subtotal & Tax
  subtotal DECIMAL(10,2),
  gst_amount DECIMAL(10,2),
  
  -- Final Amounts
  estimated_min DECIMAL(10,2) NOT NULL,  -- -10% buffer
  estimated_mid DECIMAL(10,2) NOT NULL,  -- Actual estimate
  estimated_max DECIMAL(10,2) NOT NULL,  -- +10% buffer
  
  -- Calculation Details (JSON)
  calculation_details JSONB,
  
  -- Agent Quote Comparison
  agent_quoted_amount DECIMAL(10,2),
  variance_percent DECIMAL(5,2),
  variance_reason TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_move_estimates_move ON move_estimates(move_id);

-- 4. INSERT DEFAULT NATIONAL PRICING CONFIG
-- Based on market research average rates
INSERT INTO pricing_configs (
  config_name,
  city,
  is_default,
  is_active,
  base_1bhk,
  base_2bhk,
  base_3bhk,
  base_4bhk,
  base_5bhk,
  rate_per_km_local,
  rate_per_km_regional,
  rate_per_km_intercity,
  floor_charge_no_lift,
  floor_charge_with_lift,
  packing_material_percent,
  fragile_items_percent,
  labor_cost_per_person,
  default_labor_count,
  insurance_percent,
  gst_percent,
  local_distance_max,
  regional_distance_max,
  notes
) VALUES (
  'Default National Pricing',
  NULL,  -- NULL = applies everywhere
  true,  -- is_default
  true,  -- is_active
  5500,  -- 1BHK base
  10000, -- 2BHK base
  16000, -- 3BHK base
  21000, -- 4BHK base
  28000, -- 5BHK base
  12,    -- Local ₹12/km
  20,    -- Regional ₹20/km
  15,    -- Intercity ₹15/km
  400,   -- Floor charge (no lift)
  0,     -- Floor charge (with lift)
  25,    -- Packing 25%
  5,     -- Fragile 5%
  700,   -- Labor ₹700/person
  3,     -- 3 laborers
  0.5,   -- Insurance 0.5%
  18,    -- GST 18%
  50,    -- Local max 50km
  200,   -- Regional max 200km
  'Market research based pricing - Jan 2026. Source: Multiple packers & movers platforms.'
)
ON CONFLICT DO NOTHING;

-- 5. INSERT CITY-SPECIFIC PRICING (Premium Cities)
-- Mumbai - Slightly higher due to traffic, parking challenges
INSERT INTO pricing_configs (
  config_name,
  city,
  is_default,
  is_active,
  base_1bhk,
  base_2bhk,
  base_3bhk,
  base_4bhk,
  base_5bhk,
  rate_per_km_local,
  floor_charge_no_lift,
  packing_material_percent,
  notes
) VALUES (
  'Mumbai Premium Pricing',
  'Mumbai',
  false,
  true,
  6000,  -- +9% vs national
  11000, -- +10% vs national
  17500, -- +9% vs national
  23000, -- +9.5% vs national
  30000,
  14,    -- ₹14/km (vs ₹12 national)
  500,   -- ₹500/floor (vs ₹400 national)
  28,    -- 28% packing (vs 25% national)
  'Mumbai pricing accounts for traffic congestion, parking challenges, and higher labor costs.'
)
ON CONFLICT DO NOTHING;

-- Success message
SELECT 
  '✅ Pricing system schema created!' as status,
  COUNT(*) as pricing_configs
FROM pricing_configs;
