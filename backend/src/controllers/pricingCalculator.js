// ========================================
// PRICING CALCULATION SERVICE
// Calculates move estimates based on admin configs
// ========================================

const db = require('../../config/db');

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize city name for matching
function normalizeCity(cityName) {
  if (!cityName) return null;
  return cityName.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(city|nagar|pur)\b/gi, '')
    .trim();
}

// Get pricing config for a city (fallback to default)
async function getPricingConfig(cityName) {
  const normalizedCity = normalizeCity(cityName);
  
  // Try to find city-specific pricing
  if (normalizedCity) {
    const cityConfig = await db.query(
      `SELECT * FROM pricing_configs 
       WHERE LOWER(city) = $1 AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [normalizedCity]
    );
    
    if (cityConfig.rows.length > 0) {
      return cityConfig.rows[0];
    }
  }
  
  // Fallback to default pricing
  const defaultConfig = await db.query(
    `SELECT * FROM pricing_configs 
     WHERE is_default = true AND is_active = true 
     LIMIT 1`
  );
  
  if (defaultConfig.rows.length === 0) {
    throw new Error('No pricing configuration found. Please contact admin.');
  }
  
  return defaultConfig.rows[0];
}

// Check for pricing overrides for specific route
async function getPricingOverride(fromCity, toCity, distance) {
  const normalizedFrom = normalizeCity(fromCity);
  const normalizedTo = normalizeCity(toCity);
  
  if (!normalizedFrom || !normalizedTo) return null;
  
  const override = await db.query(
    `SELECT * FROM pricing_overrides 
     WHERE LOWER(from_city) = $1 
       AND LOWER(to_city) = $2 
       AND is_active = true
     ORDER BY created_at DESC 
     LIMIT 1`,
    [normalizedFrom, normalizedTo]
  );
  
  if (override.rows.length > 0) {
    return override.rows[0];
  }
  
  // Check distance-based overrides
  if (distance) {
    const distanceOverride = await db.query(
      `SELECT * FROM pricing_overrides 
       WHERE distance_min <= $1 
         AND distance_max >= $1 
         AND is_active = true
       ORDER BY created_at DESC 
       LIMIT 1`,
      [distance]
    );
    
    if (distanceOverride.rows.length > 0) {
      return distanceOverride.rows[0];
    }
  }
  
  return null;
}

// Main function to calculate move estimate
async function calculateMoveEstimate(moveData) {
  try {
    const {
      move_id,
      bhk_type,
      from_city,
      to_city,
      from_lat,
      from_lng,
      to_lat,
      to_lng,
      floor_from = 0,
      floor_to = 0,
      has_lift_from = false,
      has_lift_to = false,
      has_fragile = false
    } = moveData;

    // 1. Calculate distance
    const distance = calculateDistance(
      parseFloat(from_lat),
      parseFloat(from_lng),
      parseFloat(to_lat),
      parseFloat(to_lng)
    );

    // 2. Get pricing config (city-specific or default)
    const config = await getPricingConfig(to_city || from_city);

    // 3. Check for pricing overrides
    const override = await getPricingOverride(from_city, to_city, distance);

    // 4. Get base amount for BHK type
    let baseAmount = 0;
    const bhkKey = `base_${bhk_type}`.toLowerCase();
    
    if (override && override[`override_${bhk_type}`]) {
      baseAmount = parseFloat(override[`override_${bhk_type}`]);
    } else if (config[bhkKey]) {
      baseAmount = parseFloat(config[bhkKey]);
    } else {
      // Fallback based on BHK number
      const bhkNum = parseInt(bhk_type.replace('bhk', ''));
      baseAmount = config.base_2bhk * (bhkNum / 2); // Proportional estimate
    }

    const breakdown = {
      base_amount: baseAmount,
      distance_km: Math.round(distance * 100) / 100
    };

    // 5. Distance charges
    let ratePerKm = config.rate_per_km_local;
    let distanceCategory = 'local';
    
    if (override && override.override_rate_per_km) {
      ratePerKm = parseFloat(override.override_rate_per_km);
      distanceCategory = 'custom';
    } else if (distance > config.regional_distance_max) {
      ratePerKm = parseFloat(config.rate_per_km_intercity);
      distanceCategory = 'intercity';
    } else if (distance > config.local_distance_max) {
      ratePerKm = parseFloat(config.rate_per_km_regional);
      distanceCategory = 'regional';
    }
    
    const distanceCharges = distance * ratePerKm;
    breakdown.distance_charges = Math.round(distanceCharges);
    breakdown.distance_category = distanceCategory;
    breakdown.rate_per_km = ratePerKm;

    // 6. Floor charges
    let floorCharges = 0;
    const floorRate = parseFloat(config.floor_charge_no_lift);
    
    if (!has_lift_from && floor_from > 0) {
      floorCharges += floor_from * floorRate;
    }
    if (!has_lift_to && floor_to > 0) {
      floorCharges += floor_to * floorRate;
    }
    
    breakdown.floor_charges = Math.round(floorCharges);

    // 7. Packing material charges (% of base)
    const packingPercent = parseFloat(config.packing_material_percent);
    const packingCharges = (baseAmount * packingPercent) / 100;
    breakdown.packing_charges = Math.round(packingCharges);

    // 8. Labor charges
    const laborCost = parseFloat(config.labor_cost_per_person);
    const laborCount = parseInt(config.default_labor_count);
    const laborCharges = laborCost * laborCount;
    breakdown.labor_charges = laborCharges;

    // 9. Fragile items surcharge
    let fragileCharges = 0;
    if (has_fragile) {
      const fragilePercent = parseFloat(config.fragile_items_percent);
      fragileCharges = (baseAmount * fragilePercent) / 100;
    }
    breakdown.fragile_charges = Math.round(fragileCharges);

    // 10. Calculate subtotal
    const subtotal = 
      baseAmount + 
      breakdown.distance_charges + 
      breakdown.floor_charges + 
      breakdown.packing_charges + 
      breakdown.labor_charges + 
      breakdown.fragile_charges;

    breakdown.subtotal = Math.round(subtotal);

    // 11. GST
    const gstPercent = parseFloat(config.gst_percent);
    const gstAmount = (subtotal * gstPercent) / 100;
    breakdown.gst_amount = Math.round(gstAmount);
    breakdown.gst_percent = gstPercent;

    // 12. Calculate final estimate with margin
    let finalEstimate = subtotal + gstAmount;
    
    if (config.profit_margin_percent) {
      const marginAmount = (finalEstimate * parseFloat(config.profit_margin_percent)) / 100;
      finalEstimate += marginAmount;
      breakdown.profit_margin = Math.round(marginAmount);
    }
    
    if (config.seasonal_adjustment_percent) {
      const seasonalAmount = (finalEstimate * parseFloat(config.seasonal_adjustment_percent)) / 100;
      finalEstimate += seasonalAmount;
      breakdown.seasonal_adjustment = Math.round(seasonalAmount);
    }

    // 13. Create estimate range (±10%)
    const estimatedMid = Math.round(finalEstimate);
    const estimatedMin = Math.round(finalEstimate * 0.9);
    const estimatedMax = Math.round(finalEstimate * 1.1);

    // 14. Prepare result
    const result = {
      config_id: config.id,
      config_name: config.config_name,
      estimated_min: estimatedMin,
      estimated_mid: estimatedMid,
      estimated_max: estimatedMax,
      breakdown: breakdown,
      calculation_details: {
        distance_km: breakdown.distance_km,
        distance_category: distanceCategory,
        pricing_config: config.config_name,
        override_applied: override ? true : false
      }
    };

    // 15. Save estimate to database if move_id provided
    if (move_id) {
      await db.query(
        `INSERT INTO move_estimates (
          move_id, config_id, base_amount, distance_km,
          distance_charges, floor_charges, packing_charges,
          labor_charges, fragile_charges, subtotal, gst_amount,
          estimated_min, estimated_mid, estimated_max,
          calculation_details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (move_id) DO UPDATE SET
          config_id = EXCLUDED.config_id,
          base_amount = EXCLUDED.base_amount,
          distance_km = EXCLUDED.distance_km,
          distance_charges = EXCLUDED.distance_charges,
          floor_charges = EXCLUDED.floor_charges,
          packing_charges = EXCLUDED.packing_charges,
          labor_charges = EXCLUDED.labor_charges,
          fragile_charges = EXCLUDED.fragile_charges,
          subtotal = EXCLUDED.subtotal,
          gst_amount = EXCLUDED.gst_amount,
          estimated_min = EXCLUDED.estimated_min,
          estimated_mid = EXCLUDED.estimated_mid,
          estimated_max = EXCLUDED.estimated_max,
          calculation_details = EXCLUDED.calculation_details,
          updated_at = CURRENT_TIMESTAMP`,
        [
          move_id, config.id, breakdown.base_amount, breakdown.distance_km,
          breakdown.distance_charges, breakdown.floor_charges, breakdown.packing_charges,
          breakdown.labor_charges, breakdown.fragile_charges, breakdown.subtotal,
          breakdown.gst_amount, estimatedMin, estimatedMid, estimatedMax,
          JSON.stringify(result.calculation_details)
        ]
      );
    }

    return result;

  } catch (error) {
    console.error('❌ Pricing calculation error:', error);
    throw error;
  }
}

module.exports = {
  calculateMoveEstimate,
  getPricingConfig,
  calculateDistance,
  normalizeCity
};
