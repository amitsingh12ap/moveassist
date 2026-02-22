const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../../config/db');

const BOX_STATUSES = ['created', 'packed', 'loaded', 'in_transit', 'delivered'];

exports.getByMove = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, 
        (SELECT json_agg(s ORDER BY s.scanned_at DESC) FROM box_scans s WHERE s.box_id = b.id) as scan_history
       FROM boxes b WHERE b.move_id = $1 ORDER BY b.created_at ASC`,
      [req.params.moveId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch boxes' });
  }
};

exports.create = async (req, res) => {
  const { label, category, contents } = req.body;
  const { moveId } = req.params;

  try {
    const qrCode = uuidv4();
    const qrUrl = `${process.env.BASE_URL}/api/boxes/qr/${qrCode}`;
    const qrImageDataUrl = await QRCode.toDataURL(qrUrl);

    const result = await db.query(
      `INSERT INTO boxes (move_id, qr_code, label, category, contents, qr_image_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [moveId, qrCode, label, category, contents, qrImageDataUrl]
    );

    // Update total_boxes count on move
    await db.query('UPDATE moves SET total_boxes = total_boxes + 1 WHERE id = $1', [moveId]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create box' });
  }
};

exports.scan = async (req, res) => {
  const { qrCode } = req.params;
  const { status, location, notes } = req.body;

  if (!BOX_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', valid: BOX_STATUSES });
  }

  try {
    const boxResult = await db.query('SELECT * FROM boxes WHERE qr_code = $1', [qrCode]);
    if (!boxResult.rows[0]) return res.status(404).json({ error: 'Box not found' });

    const box = boxResult.rows[0];

    // Log the scan
    await db.query(
      'INSERT INTO box_scans (box_id, status, scanned_by, location, notes) VALUES ($1,$2,$3,$4,$5)',
      [box.id, status, req.user.id, location, notes]
    );

    // Update box status
    await db.query('UPDATE boxes SET status = $1, updated_at = NOW() WHERE id = $2', [status, box.id]);

    res.json({ message: 'Scan logged', box_id: box.id, new_status: status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log scan' });
  }
};

exports.getByQR = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, m.title as move_title,
        (SELECT json_agg(s ORDER BY s.scanned_at DESC) FROM box_scans s WHERE s.box_id = b.id) as scan_history
       FROM boxes b LEFT JOIN moves m ON m.id = b.move_id WHERE b.qr_code = $1`,
      [req.params.qrCode]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Box not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed' });
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!BOX_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await db.query(
      'UPDATE boxes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM boxes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Box deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete box' });
  }
};
