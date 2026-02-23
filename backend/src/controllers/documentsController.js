const db = require('../../config/db');

exports.upload = async (req, res) => {
  const { name, doc_type, file_url } = req.body;
  const r = await db.query(
    `INSERT INTO move_documents (move_id,uploaded_by,name,doc_type,file_url)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.moveId, req.user.id, name, doc_type || 'other', file_url]
  );
  res.json(r.rows[0]);
};

exports.getByMove = async (req, res) => {
  const r = await db.query(
    `SELECT d.*, u.name as uploaded_by_name FROM move_documents d
     JOIN users u ON u.id=d.uploaded_by
     WHERE d.move_id=$1 ORDER BY d.created_at DESC`,
    [req.params.moveId]
  );
  res.json(r.rows);
};

exports.remove = async (req, res) => {
  await db.query('DELETE FROM move_documents WHERE id=$1 AND uploaded_by=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
};
