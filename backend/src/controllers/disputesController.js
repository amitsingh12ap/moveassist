const db = require('../../config/db');

exports.create = async (req, res) => {
  const { furniture_id, description, client_photo_url } = req.body;
  const { moveId } = req.params;
  const r = await db.query(
    `INSERT INTO disputes (move_id,raised_by,furniture_id,description,client_photo_url)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [moveId, req.user.id, furniture_id || null, description, client_photo_url || null]
  );
  // Notify admin
  const admins = await db.query(`SELECT id FROM users WHERE role='admin'`);
  const move = await db.query('SELECT title FROM moves WHERE id=$1', [moveId]);
  for (const admin of admins.rows) {
    await db.query(
      `INSERT INTO notifications (user_id,move_id,type,title,body) VALUES ($1,$2,$3,$4,$5)`,
      [admin.id, moveId, 'dispute_raised',
       `Damage dispute raised`,
       `Client raised a dispute on move "${move.rows[0]?.title}"`]
    );
  }
  res.json(r.rows[0]);
};

exports.getByMove = async (req, res) => {
  const r = await db.query(
    `SELECT d.*, u.name as raised_by_name, f.name as furniture_name
     FROM disputes d
     LEFT JOIN users u ON u.id=d.raised_by
     LEFT JOIN furniture_items f ON f.id=d.furniture_id
     WHERE d.move_id=$1 ORDER BY d.created_at DESC`,
    [req.params.moveId]
  );
  res.json(r.rows);
};

exports.resolve = async (req, res) => {
  const { admin_notes } = req.body;
  const r = await db.query(
    `UPDATE disputes SET status='resolved', admin_notes=$1, resolved_at=NOW(), updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [admin_notes, req.params.id]
  );
  res.json(r.rows[0]);
};
