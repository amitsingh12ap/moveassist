const db = require('../../config/db');
const activities = require('./activitiesController');

exports.getByMove = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.*, 
        (SELECT json_agg(p ORDER BY p.taken_at ASC) FROM furniture_photos p WHERE p.furniture_id = f.id) as photos
       FROM furniture_items f WHERE f.move_id = $1 ORDER BY f.created_at ASC`,
      [req.params.moveId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch furniture' });
  }
};

exports.create = async (req, res) => {
  const { name, category, condition_before, damage_notes, photo_url } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO furniture_items (move_id, name, category, condition_before, damage_notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.moveId, name, category, condition_before, damage_notes]
    );
    const item = result.rows[0];
    if (photo_url) {
      await db.query(
        'INSERT INTO furniture_photos (furniture_id, photo_url, photo_type) VALUES ($1,$2,$3)',
        [item.id, photo_url, 'before']
      );
    }
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create furniture item' });
  }
};

// Accept base64 photo directly (no multer)
exports.addPhotoBase64 = async (req, res) => {
  const { photo_url, photo_type, damage_tagged, damage_description } = req.body;
  if (!photo_url) return res.status(400).json({ error: 'photo_url required' });
  try {
    const result = await db.query(
      `INSERT INTO furniture_photos (furniture_id, photo_url, photo_type, damage_tagged, damage_description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, photo_url, photo_type || 'before', damage_tagged || false, damage_description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add photo' });
  }
};

exports.updateConditionAfter = async (req, res) => {
  const { condition_after, damage_notes, photo_url } = req.body;
  try {
    const result = await db.query(
      'UPDATE furniture_items SET condition_after=$1, damage_notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [condition_after, damage_notes, req.params.id]
    );
    const item = result.rows[0];
    if (photo_url) {
      await db.query(
        'INSERT INTO furniture_photos (furniture_id, photo_url, photo_type) VALUES ($1,$2,$3)',
        [item.id, photo_url, 'after']
      );
    }
    // Log activity
    await activities.create(item.move_id, req.user.id, req.user.role, 'furniture_delivered',
      `"${item.name}" delivered — condition: ${condition_after}`,
      damage_notes || '', { furniture_id: item.id, condition_after, condition_before: item.condition_before }
    );
    // Notify client if condition changed
    if (item.condition_before && condition_after && condition_after !== item.condition_before) {
      const move = await db.query('SELECT user_id FROM moves WHERE id=$1', [item.move_id]);
      if (move.rows[0]) {
        await db.query(
          `INSERT INTO notifications (user_id,move_id,type,title,body) VALUES ($1,$2,$3,$4,$5)`,
          [move.rows[0].user_id, item.move_id, 'condition_change',
           `Condition change: ${item.name}`,
           `${item.name} was ${item.condition_before} before move, now ${condition_after}. Check photos.`]
        );
      }
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update condition' });
  }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM furniture_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Furniture item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM furniture_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Furniture item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
};
