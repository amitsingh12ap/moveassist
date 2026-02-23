const db = require('../../config/db');

// Customer: get own moves
exports.getAll = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id), 0) as total_boxes,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id AND status='delivered'), 0) as delivered_boxes
       FROM moves m WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch moves' });
  }
};

// Agent / Admin: get assigned moves
exports.getAgentMoves = async (req, res) => {
  try {
    let query, params = [];
    if (req.user.role === 'admin') {
      query = `SELECT m.*, u.name as user_name, u.phone as customer_phone,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id),0) as total_boxes,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id AND status='delivered'),0) as delivered_boxes,
        COALESCE((SELECT COUNT(*) FROM furniture_items WHERE move_id=m.id),0) as total_furniture,
        COALESCE((SELECT COUNT(*) FROM furniture_items WHERE move_id=m.id AND condition_after IS NOT NULL),0) as delivered_furniture
        FROM moves m JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC`;
    } else {
      query = `SELECT m.*, u.name as user_name, u.phone as customer_phone,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id),0) as total_boxes,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id AND status='delivered'),0) as delivered_boxes,
        COALESCE((SELECT COUNT(*) FROM furniture_items WHERE move_id=m.id),0) as total_furniture,
        COALESCE((SELECT COUNT(*) FROM furniture_items WHERE move_id=m.id AND condition_after IS NOT NULL),0) as delivered_furniture
        FROM moves m JOIN users u ON u.id=m.user_id
        WHERE m.agent_id=$1 ORDER BY m.move_date ASC NULLS LAST`;
      params = [req.user.id];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch agent moves' });
  }
};

// Admin: all moves with agent info
exports.getAllAdmin = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, u.name as customer_name, a.name as agent_name,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id), 0) as total_boxes
       FROM moves m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN users a ON a.id = m.agent_id
       ORDER BY m.created_at DESC`
    );
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch all moves' });
  }
};

exports.create = async (req, res) => {
  const { title, from_address, to_address, move_date } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO moves (user_id, title, from_address, to_address, move_date, status, payment_status)
       VALUES ($1,$2,$3,$4,$5,'payment_pending','pending') RETURNING *`,
      [req.user.id, title, from_address, to_address, move_date]
    );
    res.status(201).json(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Failed to create move' });
  }
};

exports.getOne = async (req, res) => {
  try {
    // Agents/admins can also view any move
    let result;
    if (req.user.role === 'agent' || req.user.role === 'admin') {
      result = await db.query('SELECT * FROM moves WHERE id=$1', [req.params.id]);
    } else {
      result = await db.query('SELECT * FROM moves WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    }
    if (!result.rows[0]) return res.status(404).json({ error: 'Move not found' });
    res.json(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch move' });
  }
};

exports.update = async (req, res) => {
  const { title, from_address, to_address, move_date, status } = req.body;
  try {
    const result = await db.query(
      `UPDATE moves SET title=$1, from_address=$2, to_address=$3, move_date=$4,
       status=$5, updated_at=NOW() WHERE id=$6 AND user_id=$7 RETURNING *`,
      [title, from_address, to_address, move_date, status, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Move not found' });
    res.json(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Failed to update move' });
  }
};

// Admin: assign agent to move
exports.assignAgent = async (req, res) => {
  const { agent_id } = req.body;
  try {
    const result = await db.query(
      'UPDATE moves SET agent_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [agent_id, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Failed to assign agent' });
  }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM moves WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Move deleted' });
  } catch(err) {
    res.status(500).json({ error: 'Failed to delete move' });
  }
};

exports.completeMove = async (req, res) => {
  const { id } = req.params;
  try {
    // Validation 1: all boxes delivered
    const boxCheck = await db.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='delivered') as delivered FROM boxes WHERE move_id=$1`,
      [id]
    );
    const { total, delivered } = boxCheck.rows[0];
    if (parseInt(total) > 0 && parseInt(delivered) < parseInt(total)) {
      return res.status(400).json({
        error: `${parseInt(total) - parseInt(delivered)} box${parseInt(total)-parseInt(delivered)>1?'es':''} not yet delivered`,
        code: 'BOXES_PENDING'
      });
    }

    // Validation 2: all furniture has condition_after logged
    const furnCheck = await db.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE condition_after IS NOT NULL) as logged FROM furniture_items WHERE move_id=$1`,
      [id]
    );
    const { total: furnTotal, logged } = furnCheck.rows[0];
    if (parseInt(furnTotal) > 0 && parseInt(logged) < parseInt(furnTotal)) {
      return res.status(400).json({
        error: `${parseInt(furnTotal) - parseInt(logged)} furniture item${parseInt(furnTotal)-parseInt(logged)>1?'s':''} not marked as delivered`,
        code: 'FURNITURE_PENDING'
      });
    }

    // Validation 4: all furniture has a delivery (after) photo
    const deliveryPhotoCheck = await db.query(
      `SELECT f.id, f.name FROM furniture_items f
       WHERE f.move_id=$1 AND f.condition_after IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM furniture_photos p WHERE p.furniture_id=f.id AND p.photo_type='after')`,
      [id]
    );
    if (deliveryPhotoCheck.rows.length > 0) {
      const names = deliveryPhotoCheck.rows.map(r => r.name).join(', ');
      return res.status(400).json({
        error: `Missing delivery photo for: ${names}`,
        code: 'MISSING_DELIVERY_PHOTO'
      });
    }

    await db.query(
      `UPDATE moves SET status='completed', updated_at=NOW() WHERE id=$1 AND (status='in_progress' OR status='active') RETURNING *`,
      [id]
    );
    res.json({ message: 'Move completed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete move' });
  }
};
