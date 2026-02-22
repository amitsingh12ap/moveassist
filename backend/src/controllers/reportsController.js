const PDFDocument = require('pdfkit');
const db = require('../../config/db');

exports.generate = async (req, res) => {
  const startTime = Date.now();
  const { moveId } = req.params;

  try {
    // Fetch move data
    const moveResult = await db.query(
      'SELECT m.*, u.name as user_name, u.email FROM moves m JOIN users u ON u.id = m.user_id WHERE m.id = $1 AND m.user_id = $2',
      [moveId, req.user.id]
    );
    if (!moveResult.rows[0]) return res.status(404).json({ error: 'Move not found' });
    const move = moveResult.rows[0];

    // Fetch boxes with scan history
    const boxesResult = await db.query(
      `SELECT b.*, 
        (SELECT json_agg(s ORDER BY s.scanned_at ASC) FROM box_scans s WHERE s.box_id = b.id) as scan_history
       FROM boxes b WHERE b.move_id = $1`,
      [moveId]
    );
    const boxes = boxesResult.rows;

    // Fetch furniture with photos
    const furnitureResult = await db.query(
      `SELECT f.*,
        (SELECT json_agg(p ORDER BY p.taken_at ASC) FROM furniture_photos p WHERE p.furniture_id = f.id) as photos
       FROM furniture_items f WHERE f.move_id = $1`,
      [moveId]
    );
    const furniture = furnitureResult.rows;

    // Calculate stats
    const deliveredBoxes = boxes.filter(b => b.status === 'delivered').length;
    const missingBoxes = boxes.filter(b => b.status !== 'delivered').length;
    const damagedFurniture = furniture.filter(f => f.condition_after && f.condition_after !== f.condition_before);

    // Build PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="move-report-${moveId}.pdf"`);
    doc.pipe(res);

    // ---- HEADER ----
    doc.fontSize(24).fillColor('#1a1a2e').text('MoveAssist', { align: 'center' });
    doc.fontSize(12).fillColor('#666').text('Move Summary Report', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ddd');
    doc.moveDown();

    // ---- MOVE DETAILS ----
    doc.fontSize(16).fillColor('#1a1a2e').text('Move Details');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333');
    doc.text(`Owner: ${move.user_name} (${move.email})`);
    doc.text(`From: ${move.from_address || 'N/A'}`);
    doc.text(`To: ${move.to_address || 'N/A'}`);
    doc.text(`Move Date: ${move.move_date ? new Date(move.move_date).toDateString() : 'N/A'}`);
    doc.text(`Status: ${move.status.toUpperCase()}`);
    doc.moveDown();

    // ---- BOX SUMMARY ----
    doc.fontSize(16).fillColor('#1a1a2e').text('Box Tracking Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333');
    doc.text(`Total Boxes: ${boxes.length}`);
    doc.text(`Delivered: ${deliveredBoxes}`);
    doc.text(`Missing / Not Delivered: ${missingBoxes}`, { fillColor: missingBoxes > 0 ? 'red' : '#333' });
    doc.moveDown();

    // Box list
    boxes.forEach((box, i) => {
      const statusColor = box.status === 'delivered' ? '#22c55e' : '#f59e0b';
      doc.fontSize(10).fillColor('#1a1a2e').text(`Box ${i + 1}: ${box.label || 'Unlabeled'} [${box.category || 'General'}]`);
      doc.fontSize(9).fillColor(statusColor).text(`  Status: ${box.status.toUpperCase()}`);
      doc.fillColor('#666').text(`  QR: ${box.qr_code}`);
      if (box.scan_history && box.scan_history.length > 0) {
        const last = box.scan_history[box.scan_history.length - 1];
        doc.text(`  Last Scan: ${new Date(last.scanned_at).toLocaleString()} — ${last.status}`);
      }
      doc.moveDown(0.3);
    });

    doc.moveDown();

    // ---- FURNITURE ----
    doc.fontSize(16).fillColor('#1a1a2e').text('Furniture Documentation');
    doc.moveDown(0.5);
    furniture.forEach(item => {
      doc.fontSize(11).fillColor('#1a1a2e').text(`${item.name} [${item.category || 'General'}]`);
      doc.fontSize(9).fillColor('#333').text(`  Before: ${item.condition_before || 'N/A'}  →  After: ${item.condition_after || 'Not recorded'}`);
      if (item.damage_notes) {
        doc.fillColor('#dc2626').text(`  Damage Notes: ${item.damage_notes}`);
      }
      doc.fillColor('#999').text(`  Photos: ${item.photos ? item.photos.length : 0}`);
      doc.moveDown(0.5);
    });

    // ---- FOOTER ----
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ddd');
    doc.moveDown(0.5);
    const generationTime = Date.now() - startTime;
    doc.fontSize(9).fillColor('#999')
      .text(`Report generated on ${new Date().toLocaleString()} in ${generationTime}ms`, { align: 'center' });
    doc.text('MoveAssist — Home shifting made structured', { align: 'center' });

    doc.end();

    // Save generation record
    await db.query(
      'INSERT INTO move_reports (move_id, generation_time_ms) VALUES ($1, $2)',
      [moveId, generationTime]
    );

  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
};

exports.download = async (req, res) => {
  // Re-generate on demand (stateless PDF approach)
  req.params.moveId = req.params.moveId;
  return exports.generate(req, res);
};
