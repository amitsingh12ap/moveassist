const db = require('../../config/db');

exports.create = async (req, res) => {
  const { rating, review } = req.body;
  const { moveId } = req.params;
  // Verify move belongs to user
  const move = await db.query('SELECT * FROM moves WHERE id=$1 AND user_id=$2', [moveId, req.user.id]);
  if (!move.rows[0]) return res.status(404).json({ error: 'Move not found' });
  if (move.rows[0].status !== 'completed') return res.status(400).json({ error: 'Can only rate completed moves' });
  const existing = await db.query('SELECT id FROM move_ratings WHERE move_id=$1', [moveId]);
  if (existing.rows[0]) return res.status(400).json({ error: 'Already rated' });
  const r = await db.query(
    `INSERT INTO move_ratings (move_id,user_id,rating,review) VALUES ($1,$2,$3,$4) RETURNING *`,
    [moveId, req.user.id, rating, review || null]
  );
  await db.query('UPDATE moves SET rated=true WHERE id=$1', [moveId]);
  // Notify agent if assigned
  if (move.rows[0].agent_id) {
    await db.query(
      `INSERT INTO notifications (user_id,move_id,type,title,body) VALUES ($1,$2,$3,$4,$5)`,
      [move.rows[0].agent_id, moveId, 'rating_received',
       `You received a ${rating}★ rating`,
       review || 'Client left a rating for the completed move']
    );
  }
  res.json(r.rows[0]);
};

exports.getByMove = async (req, res) => {
  const r = await db.query('SELECT * FROM move_ratings WHERE move_id=$1', [req.params.moveId]);
  res.json(r.rows[0] || null);
};
