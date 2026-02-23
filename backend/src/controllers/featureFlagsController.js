const db = require('../../config/db');

exports.getAll = async (req, res) => {
  const r = await db.query('SELECT * FROM feature_flags ORDER BY key');
  res.json(r.rows);
};

exports.getOne = async (req, res) => {
  const r = await db.query('SELECT * FROM feature_flags WHERE key=$1', [req.params.key]);
  if (!r.rows[0]) return res.json({ key: req.params.key, enabled: false });
  res.json(r.rows[0]);
};

exports.update = async (req, res) => {
  const { enabled } = req.body;
  await db.query(
    'UPDATE feature_flags SET enabled=$1, updated_at=NOW() WHERE key=$2',
    [enabled, req.params.key]
  );
  res.json({ key: req.params.key, enabled });
};
