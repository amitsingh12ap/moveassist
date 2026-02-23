const db = require('../../config/db');

// Get activities for a move
exports.getByMove = async (req, res) => {
  const r = await db.query(
    `SELECT a.*, u.name as actor_name FROM move_activities a
     LEFT JOIN users u ON u.id=a.actor_id
     WHERE a.move_id=$1 ORDER BY a.created_at ASC`,
    [req.params.moveId]
  );
  res.json(r.rows);
};

// Create activity (internal helper + endpoint)
exports.create = async (moveId, actorId, actorRole, type, title, description='', metadata={}) => {
  const r = await db.query(
    `INSERT INTO move_activities (move_id,actor_id,actor_role,type,title,description,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [moveId, actorId, actorRole, type, title, description, JSON.stringify(metadata)]
  );
  // Also create notification for the move owner
  try {
    const move = await db.query('SELECT user_id FROM moves WHERE id=$1', [moveId]);
    if (move.rows[0] && move.rows[0].user_id !== actorId) {
      await db.query(
        `INSERT INTO notifications (user_id,move_id,type,title,body)
         VALUES ($1,$2,$3,$4,$5)`,
        [move.rows[0].user_id, moveId, type, title, description]
      );
    }
  } catch(e) { /* non-fatal */ }
  return r.rows[0];
};

exports.add = async (req, res) => {
  const { type, title, description, metadata } = req.body;
  const activity = await exports.create(
    req.params.moveId, req.user.id, req.user.role,
    type, title, description, metadata
  );
  res.json(activity);
};
