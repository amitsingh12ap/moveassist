const db = require('../../config/db');

// Get all addon services (catalog)
exports.getAllServices = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM addon_services WHERE is_active = true ORDER BY sort_order, category, name`);
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Get available services for a specific move (agent/admin)
exports.getAvailableServices = async (req, res) => {
  try {
    const { moveId } = req.params;
    const services = await db.query(`SELECT * FROM addon_services WHERE is_active = true ORDER BY sort_order, category, name`);
    const booked = await db.query(
      `SELECT ma.*, a.name as service_name, a.icon, a.category FROM move_addons ma JOIN addon_services a ON a.id = ma.addon_id WHERE ma.move_id = $1`,
      [moveId]
    );
    res.json({ available: services.rows, booked: booked.rows });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Add an addon to a move
exports.addToMove = async (req, res) => {
  const { move_id, addon_id, quantity = 1, notes } = req.body;
  try {
    const svc = await db.query('SELECT * FROM addon_services WHERE id = $1', [addon_id]);
    if (!svc.rows[0]) return res.status(404).json({ error: 'Service not found' });
    const s = svc.rows[0];
    const unit_price = parseFloat(s.base_price);
    const total_price = unit_price * quantity;
    const result = await db.query(
      `INSERT INTO move_addons (move_id, addon_id, quantity, unit_price, total_price, added_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [move_id, addon_id, quantity, unit_price, total_price, req.user.id, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Remove an addon from a move
exports.removeFromMove = async (req, res) => {
  try {
    await db.query('DELETE FROM move_addons WHERE id = $1', [req.params.id]);
    res.json({ message: 'Addon removed' });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Get booked addons for a move
exports.getMoveAddons = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ma.*, a.name as service_name, a.icon, a.category, a.description
       FROM move_addons ma JOIN addon_services a ON a.id = ma.addon_id
       WHERE ma.move_id = $1 ORDER BY ma.created_at`,
      [req.params.moveId]
    );
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Admin: create service
exports.createService = async (req, res) => {
  const { name, description, category, icon, pricing_type, base_price, unit } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO addon_services (name, description, category, icon, pricing_type, base_price, unit, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description, category, icon||'🔧', pricing_type||'fixed', base_price, unit, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Admin: update service
exports.updateService = async (req, res) => {
  const { name, description, category, icon, base_price, is_active } = req.body;
  try {
    const result = await db.query(
      `UPDATE addon_services SET name=$1,description=$2,category=$3,icon=$4,base_price=$5,is_active=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, description, category, icon, base_price, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// Admin: delete service
exports.deleteService = async (req, res) => {
  try {
    await db.query('UPDATE addon_services SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: 'Service deactivated' });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.getServiceById = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM addon_services WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.calculatePrice = async (req, res) => {
  const { addon_id, quantity = 1 } = req.body;
  try {
    const svc = await db.query('SELECT * FROM addon_services WHERE id=$1', [addon_id]);
    if (!svc.rows[0]) return res.status(404).json({ error: 'Not found' });
    const total = parseFloat(svc.rows[0].base_price) * quantity;
    res.json({ total, unit_price: svc.rows[0].base_price, quantity });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

exports.getServiceAnalytics = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.name, a.category, COUNT(ma.id) as bookings, SUM(ma.total_price) as revenue
       FROM addon_services a LEFT JOIN move_addons ma ON ma.addon_id = a.id
       GROUP BY a.id, a.name, a.category ORDER BY bookings DESC`
    );
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
};
