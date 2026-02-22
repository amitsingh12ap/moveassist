const db = require('../../config/db');

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
  const { name, category, condition_before, damage_notes } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO furniture_items (move_id, name, category, condition_before, damage_notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.moveId, name, category, condition_before, damage_notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create furniture item' });
  }
};

exports.addPhotos = async (req, res) => {
  const { photo_type, damage_tagged, damage_description } = req.body;
  try {
    const photos = req.files.map(file => ({
      furniture_id: req.params.id,
      photo_url: file.location, // S3 URL
      photo_type: photo_type || 'before',
      damage_tagged: damage_tagged === 'true',
      damage_description,
    }));

    const inserted = [];
    for (const photo of photos) {
      const result = await db.query(
        `INSERT INTO furniture_photos (furniture_id, photo_url, photo_type, damage_tagged, damage_description)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [photo.furniture_id, photo.photo_url, photo.photo_type, photo.damage_tagged, photo.damage_description]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json(inserted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add photos' });
  }
};

exports.updateConditionAfter = async (req, res) => {
  const { condition_after, damage_notes } = req.body;
  try {
    const result = await db.query(
      'UPDATE furniture_items SET condition_after=$1, damage_notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [condition_after, damage_notes, req.params.id]
    );
    res.json(result.rows[0]);
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
