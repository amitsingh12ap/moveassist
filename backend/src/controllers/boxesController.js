const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../../config/db');
const activities = require('./activitiesController');

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
  const { status, location, notes, photo_url } = req.body;

  if (!BOX_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', valid: BOX_STATUSES });
  }

  try {
    const boxResult = await db.query('SELECT * FROM boxes WHERE qr_code = $1', [qrCode]);
    if (!boxResult.rows[0]) return res.status(404).json({ error: 'Box not found' });

    const box = boxResult.rows[0];

    await db.query(
      'INSERT INTO box_scans (box_id, status, scanned_by, location, notes, photo_url) VALUES ($1,$2,$3,$4,$5,$6)',
      [box.id, status, req.user.id, location, notes, photo_url || null]
    );

    await db.query('UPDATE boxes SET status = $1, updated_at = NOW() WHERE id = $2', [status, box.id]);
    await db.query(
      'UPDATE moves SET delivered_boxes = (SELECT COUNT(*) FROM boxes WHERE move_id=$1 AND status=\'delivered\') WHERE id=$1',
      [box.move_id]
    );
    // Log activity
    const statusLabels = { delivered:'delivered', loaded:'loaded onto truck', packed:'packed', in_transit:'in transit' };
    await activities.create(box.move_id, req.user.id, req.user.role, 'box_scanned',
      `Box "${box.label||box.qr_code}" ${statusLabels[status]||status}`,
      location ? `Location: ${location}` : '', { box_id: box.id, status, photo_url }
    );
    res.json({ message: 'Scan logged', box_id: box.id, new_status: status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log scan' });
  }
};

// ── BULK STATUS UPDATE ────────────────────────────────────────
exports.bulkScan = async (req, res) => {
  const { box_ids, status, location, notes, photo_url } = req.body;
  if (!box_ids?.length) return res.status(400).json({ error: 'box_ids required' });
  if (!BOX_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const moveIds = new Set();
    for (const boxId of box_ids) {
      await db.query(
        'INSERT INTO box_scans (box_id, status, scanned_by, location, notes, photo_url) VALUES ($1,$2,$3,$4,$5,$6)',
        [boxId, status, req.user.id, location, notes, photo_url || null]
      );
      const r = await db.query('UPDATE boxes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING move_id', [status, boxId]);
      if (r.rows[0]) moveIds.add(r.rows[0].move_id);
    }
    // Update delivered_boxes for all affected moves
    for (const moveId of moveIds) {
      await db.query(
        'UPDATE moves SET delivered_boxes = (SELECT COUNT(*) FROM boxes WHERE move_id=$1 AND status=\'delivered\') WHERE id=$1',
        [moveId]
      );
    }
    res.json({ message: `${box_ids.length} boxes updated`, new_status: status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk update' });
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
    const box = result.rows[0];
    // Log the status change as a scan entry
    await db.query(
      'INSERT INTO box_scans (box_id, status, scanned_by, notes) VALUES ($1,$2,$3,$4)',
      [box.id, status, req.user.id, 'Quick status update']
    );
    // Update delivered_boxes count on the move
    if (status === 'delivered') {
      await db.query(
        'UPDATE moves SET delivered_boxes = (SELECT COUNT(*) FROM boxes WHERE move_id=$1 AND status=\'delivered\') WHERE id=$1',
        [box.move_id]
      );
    } else {
      // Recalculate in case it was previously delivered and now changed back
      await db.query(
        'UPDATE moves SET delivered_boxes = (SELECT COUNT(*) FROM boxes WHERE move_id=$1 AND status=\'delivered\') WHERE id=$1',
        [box.move_id]
      );
    }
    res.json(box);
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
