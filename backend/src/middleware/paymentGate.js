const db = require('../../config/db');

module.exports = async (req, res, next) => {
  try {
    // Extract moveId from various param shapes
    const moveId = req.params.moveId || req.params.id;

    // For scan route — look up move via QR code
    let resolvedMoveId = moveId;
    if (!resolvedMoveId && req.params.qrCode) {
      const boxRes = await db.query(
        'SELECT move_id FROM boxes WHERE qr_code=$1', [req.params.qrCode]
      );
      resolvedMoveId = boxRes.rows[0]?.move_id;
    }

    // For furniture/:id routes — look up move via furniture item
    if (!resolvedMoveId && req.params.id && !req.params.moveId) {
      const furnRes = await db.query(
        'SELECT move_id FROM furniture_items WHERE id=$1', [req.params.id]
      );
      resolvedMoveId = furnRes.rows[0]?.move_id;
    }

    if (!resolvedMoveId) return next(); // Can't determine move — let controller handle

    const result = await db.query(
      'SELECT id, status, payment_status, amount_total, amount_paid FROM moves WHERE id=$1',
      [resolvedMoveId]
    );

    const move = result.rows[0];
    if (!move) return res.status(404).json({ error: 'Move not found' });

    const blockedStatuses = ['payment_pending', 'payment_under_verification', 'created'];
    if (blockedStatuses.includes(move.status)) {
      return res.status(402).json({
        error: 'payment_required',
        message: 'Complete payment to activate this move and access its features.',
        move_status: move.status,
        payment_status: move.payment_status,
        amount_due: parseFloat(move.amount_total || 0) - parseFloat(move.amount_paid || 0),
        cta: 'pay_now',
      });
    }

    // Partial payment — allow docs but block reports
    if (move.payment_status === 'partial' && req.path.includes('generate')) {
      return res.status(402).json({
        error: 'full_payment_required',
        message: 'Full payment is required to generate the move report.',
        move_status: move.status,
        payment_status: move.payment_status,
        amount_due: parseFloat(move.amount_total) - parseFloat(move.amount_paid),
        cta: 'pay_remaining',
      });
    }

    next();
  } catch(err) {
    console.error('PaymentGate error:', err);
    res.status(500).json({ error: 'Payment check failed' });
  }
};
