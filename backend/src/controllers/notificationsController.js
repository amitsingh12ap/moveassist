const db = require('../../config/db');

exports.getForUser = async (req, res) => {
  const r = await db.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(r.rows);
};

exports.markRead = async (req, res) => {
  await db.query(
    `UPDATE notifications SET read=true WHERE user_id=$1 AND id=ANY($2::uuid[])`,
    [req.user.id, req.body.ids]
  );
  res.json({ ok: true });
};

exports.markAllRead = async (req, res) => {
  await db.query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
};

exports.getUnreadCount = async (req, res) => {
  const r = await db.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=false',
    [req.user.id]
  );
  res.json({ count: parseInt(r.rows[0].count) });
};
