// ========================================
// PRICING ADMIN API ROUTES
// CRUD operations for pricing configurations
// ========================================

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const authenticate = require('../middleware/auth');

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/admin/pricing - Get all pricing configurations
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const configs = await db.query(`
      SELECT 
        id,
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
        packing_material_percent,
        fragile_items_percent,
        gst_percent,
        notes,
        created_at,
        updated_at
      FROM pricing_configs
      ORDER BY 
        CASE WHEN is_default THEN 0 ELSE 1 END,
        city NULLS FIRST,
        created_at DESC
    `);
    
    res.json(configs.rows);
  } catch (error) {
    console.error('Error fetching pricing configs:', error);
    res.status(500).json({ error: 'Failed to fetch pricing configurations' });
  }
});

// GET /api/admin/pricing/:id - Get single pricing config
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM pricing_configs WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing configuration not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching pricing config:', error);
    res.status(500).json({ error: 'Failed to fetch pricing configuration' });
  }
});

// POST /api/admin/pricing - Create new pricing config
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      config_name,
      city,
      is_default = false,
      is_active = true,
      base_1bhk,
      base_2bhk,
      base_3bhk,
      base_4bhk,
      base_5bhk,
      rate_per_km_local,
      rate_per_km_regional,
      rate_per_km_intercity,
      floor_charge_no_lift,
      packing_material_percent,
      fragile_items_percent,
      gst_percent,
      notes
    } = req.body;

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.query('UPDATE pricing_configs SET is_default = false WHERE is_default = true');
    }

    const result = await db.query(
      `INSERT INTO pricing_configs (
        config_name, city, is_default, is_active,
        base_1bhk, base_2bhk, base_3bhk, base_4bhk, base_5bhk,
        rate_per_km_local, rate_per_km_regional, rate_per_km_intercity,
        floor_charge_no_lift, packing_material_percent,
        fragile_items_percent, gst_percent, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        config_name, city, is_default, is_active,
        base_1bhk, base_2bhk, base_3bhk, base_4bhk, base_5bhk,
        rate_per_km_local, rate_per_km_regional, rate_per_km_intercity,
        floor_charge_no_lift, packing_material_percent,
        fragile_items_percent, gst_percent, notes, req.user.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating pricing config:', error);
    res.status(500).json({ error: 'Failed to create pricing configuration' });
  }
});

// PUT /api/admin/pricing/:id - Update pricing config
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If setting as default, unset other defaults first
    if (updates.is_default) {
      await db.query('UPDATE pricing_configs SET is_default = false WHERE is_default = true AND id != $1', [id]);
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id' && key !== 'created_at' && key !== 'created_by') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await db.query(
      `UPDATE pricing_configs SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing configuration not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating pricing config:', error);
    res.status(500).json({ error: 'Failed to update pricing configuration' });
  }
});

// DELETE /api/admin/pricing/:id - Delete pricing config
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM pricing_configs WHERE id = $1 AND is_default = false RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing configuration not found or cannot delete default config' });
    }

    res.json({ message: 'Pricing configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting pricing config:', error);
    res.status(500).json({ error: 'Failed to delete pricing configuration' });
  }
});

module.exports = router;
