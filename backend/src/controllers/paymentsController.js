const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const MOVE_STATUS_FLOW = [
  'created', 'payment_pending', 'payment_under_verification',
  'active', 'in_progress', 'completed', 'closed'
];

// GET /api/payments/move/:moveId — full payment summary
exports.getSummary = async (req, res) => {
  try {
    const move = await db.query(
      `SELECT m.*, u.name as user_name,
        mp.base_price, mp.total, mp.tax_percent, mp.discount
       FROM moves m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN move_pricing mp ON mp.move_id = m.id
       WHERE m.id = $1 AND m.user_id = $2`,
      [req.params.moveId, req.user.id]
    );
    if (!move.rows[0]) return res.status(404).json({ error: 'Move not found' });

    const payments = await db.query(
      'SELECT * FROM payments WHERE move_id = $1 ORDER BY created_at DESC',
      [req.params.moveId]
    );

    const m = move.rows[0];
    res.json({
      move_id: m.id,
      title: m.title,
      status: m.status,
      payment_status: m.payment_status,
      amount_total: parseFloat(m.amount_total || 0),
      amount_paid: parseFloat(m.amount_paid || 0),
      amount_due: parseFloat(m.amount_total || 0) - parseFloat(m.amount_paid || 0),
      invoice_number: m.invoice_number,
      pricing: move.rows[0].total ? {
        base_price: parseFloat(m.base_price),
        tax_percent: parseFloat(m.tax_percent),
        discount: parseFloat(m.discount),
        total: parseFloat(m.total),
      } : null,
      payments: payments.rows,
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
};

// POST /api/payments/move/:moveId/initiate — set pricing & initiate payment
exports.initiate = async (req, res) => {
  const { base_price, distance_km, num_rooms, has_fragile, floor_surcharge, discount } = req.body;
  const moveId = req.params.moveId;

  try {
    const fragile_surcharge = has_fragile ? 500 : 0;
    const subtotal = (parseFloat(base_price) || 0)
      + (parseFloat(floor_surcharge) || 0)
      + fragile_surcharge
      - (parseFloat(discount) || 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;
    const invoice_number = `MA-${Date.now().toString(36).toUpperCase()}`;

    // Upsert pricing
    await db.query(
      `INSERT INTO move_pricing (move_id, base_price, distance_km, num_rooms, has_fragile,
        fragile_surcharge, floor_surcharge, discount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (move_id) DO UPDATE SET
        base_price=$2, distance_km=$3, num_rooms=$4, has_fragile=$5,
        fragile_surcharge=$6, floor_surcharge=$7, discount=$8, total=$9`,
      [moveId, base_price, distance_km, num_rooms, has_fragile,
       fragile_surcharge, floor_surcharge, discount, total]
    );

    await db.query(
      `UPDATE moves SET amount_total=$1, status='payment_pending',
        payment_status='pending', invoice_number=$2, updated_at=NOW()
       WHERE id=$3`,
      [total, invoice_number, moveId]
    );

    res.json({ invoice_number, total, subtotal, tax, message: 'Payment initiated' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
};

// POST /api/payments/move/:moveId/online — simulate online payment (UPI/card)
exports.payOnline = async (req, res) => {
  const { payment_mode, amount, transaction_id } = req.body;
  const moveId = req.params.moveId;

  try {
    const moveRes = await db.query(
      'SELECT * FROM moves WHERE id=$1 AND user_id=$2', [moveId, req.user.id]
    );
    const move = moveRes.rows[0];
    if (!move) return res.status(404).json({ error: 'Move not found' });

    // In production: verify with payment gateway here
    // For MVP: auto-verify online payments
    const paymentId = uuidv4();
    const gateway_ref = `SIM_${Date.now()}`;

    await db.query(
      `INSERT INTO payments (id, move_id, user_id, amount, payment_mode, status, transaction_id, gateway_ref)
       VALUES ($1,$2,$3,$4,$5,'success',$6,$7)`,
      [paymentId, moveId, req.user.id, amount, payment_mode, transaction_id || gateway_ref, gateway_ref]
    );

    const newPaid = parseFloat(move.amount_paid || 0) + parseFloat(amount);
    const isFullyPaid = newPaid >= parseFloat(move.amount_total || 0);
    const newPaymentStatus = isFullyPaid ? 'verified' : 'partial';
    const newStatus = isFullyPaid ? 'active' : 'payment_pending';

    await db.query(
      `UPDATE moves SET amount_paid=$1, payment_status=$2, status=$3,
        activated_at=${isFullyPaid ? 'NOW()' : 'activated_at'}, updated_at=NOW()
       WHERE id=$4`,
      [newPaid, newPaymentStatus, newStatus, moveId]
    );

    res.json({
      success: true,
      payment_id: paymentId,
      amount_paid: newPaid,
      move_status: newStatus,
      payment_status: newPaymentStatus,
      message: isFullyPaid
        ? 'Payment successful! Your move is now active.'
        : `Partial payment recorded. ₹${(parseFloat(move.amount_total) - newPaid).toFixed(2)} remaining.`,
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Payment processing failed' });
  }
};

// POST /api/payments/move/:moveId/cash — agent marks cash payment received
exports.markCashReceived = async (req, res) => {
  const { amount, payment_mode, notes } = req.body;
  const moveId = req.params.moveId;

  try {
    const lockUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min lock
    const paymentId = uuidv4();

    await db.query(
      `INSERT INTO payments (id, move_id, user_id, amount, payment_mode, status, notes, recorded_by, lock_until)
       VALUES ($1,$2,$3,$4,$5,'under_verification',$6,$7,$8)`,
      [paymentId, moveId, req.user.id, amount, payment_mode || 'cash', notes, req.user.id, lockUntil]
    );

    await db.query(
      `UPDATE moves SET status='payment_under_verification',
        payment_status='under_verification', updated_at=NOW() WHERE id=$1`,
      [moveId]
    );

    res.json({
      success: true,
      payment_id: paymentId,
      message: 'Cash payment recorded. Move will be activated once verified.',
      move_status: 'payment_under_verification',
      lock_until: lockUntil,
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record cash payment' });
  }
};

// POST /api/payments/:paymentId/verify — admin verifies cash payment
exports.verifyPayment = async (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'
  const { paymentId } = req.params;

  try {
    const payRes = await db.query('SELECT * FROM payments WHERE id=$1', [paymentId]);
    const payment = payRes.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (action === 'approve') {
      await db.query(
        `UPDATE payments SET status='success', verified_by=$1, verified_at=NOW(), updated_at=NOW()
         WHERE id=$2`,
        [req.user.id, paymentId]
      );

      const moveRes = await db.query('SELECT * FROM moves WHERE id=$1', [payment.move_id]);
      const move = moveRes.rows[0];
      const newPaid = parseFloat(move.amount_paid || 0) + parseFloat(payment.amount);
      const isFullyPaid = newPaid >= parseFloat(move.amount_total || 0);

      await db.query(
        `UPDATE moves SET amount_paid=$1, payment_status=$2, status=$3,
          activated_at=${isFullyPaid ? 'NOW()' : 'activated_at'}, updated_at=NOW() WHERE id=$4`,
        [newPaid, isFullyPaid ? 'verified' : 'partial',
         isFullyPaid ? 'active' : 'payment_pending', payment.move_id]
      );

      res.json({ success: true, message: 'Payment approved. Move activated.' });
    } else {
      await db.query(
        `UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`, [paymentId]
      );
      await db.query(
        `UPDATE moves SET status='payment_pending', payment_status='failed', updated_at=NOW()
         WHERE id=$1`, [payment.move_id]
      );
      res.json({ success: true, message: 'Payment rejected.' });
    }
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// GET /api/payments/invoice/:moveId — invoice data
exports.getInvoice = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, u.name as user_name, u.email, u.phone,
        mp.base_price, mp.fragile_surcharge, mp.floor_surcharge,
        mp.discount, mp.tax_percent, mp.total
       FROM moves m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN move_pricing mp ON mp.move_id = m.id
       WHERE m.id=$1 AND m.user_id=$2`,
      [req.params.moveId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Move not found' });
    res.json(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};
