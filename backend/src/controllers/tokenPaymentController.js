const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const activities = require('./activitiesController');

// ─────────────────────────────────────────────────────────────
// FLOW:
//  1. Admin sets price on a move (setPricing)
//  2. Customer sees price → pays 10% token (initiateToken)
//  3. Admin/Agent verifies token receipt → activates move (verifyToken)
//  4. Agent does on-site → submits final quote (in agentQuoteController)
//  5. Customer pays remaining balance (payBalance)
//  6. Admin/Agent verifies balance → move fully paid (verifyBalance)
// ─────────────────────────────────────────────────────────────

const TOKEN_PERCENT = 0.10;

// ── POST /api/payments/move/:moveId/set-pricing  (admin/agent) ─
// Admin sets the confirmed price so customer knows what to pay.
exports.setPricing = async (req, res) => {
  const { moveId } = req.params;
  const {
    base_price, floor_surcharge = 0, fragile_surcharge = 0,
    discount = 0, notes
  } = req.body;

  if (!base_price || parseFloat(base_price) <= 0) {
    return res.status(400).json({ error: 'base_price is required' });
  }

  try {
    const subtotal = parseFloat(base_price) + parseFloat(floor_surcharge)
                   + parseFloat(fragile_surcharge) - parseFloat(discount);
    const tax   = Math.round(subtotal * 0.18);
    const total = subtotal + tax;
    const token = Math.round(total * TOKEN_PERCENT);
    const invoice = `MA-${Date.now().toString(36).toUpperCase()}`;

    // Upsert move_pricing
    await db.query(
      `INSERT INTO move_pricing
         (move_id, base_price, fragile_surcharge, floor_surcharge, discount, tax_percent, total)
       VALUES ($1,$2,$3,$4,$5,18,$6)
       ON CONFLICT (move_id) DO UPDATE SET
         base_price=$2, fragile_surcharge=$3, floor_surcharge=$4,
         discount=$5, tax_percent=18, total=$6`,
      [moveId, base_price, fragile_surcharge, floor_surcharge, discount, total]
    );

    await db.query(
      `UPDATE moves SET
         amount_total=$1, token_amount=$2, estimated_cost=$1,
         invoice_number=$3, status='payment_pending',
         payment_status='pending', updated_at=NOW()
       WHERE id=$4`,
      [total, token, invoice, moveId]
    );

    // Notify customer
    const m = await db.query('SELECT user_id, title FROM moves WHERE id=$1', [moveId]);
    if (m.rows[0]) {
      await db.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'price_set','💰 Your move price is ready',$3)`,
        [m.rows[0].user_id, moveId,
         `Total: ₹${total.toLocaleString('en-IN')}. Pay ₹${token.toLocaleString('en-IN')} (10%) to confirm your booking.`]
      );
    }

    await activities.create(moveId, req.user.id, req.user.role, 'price_set',
      `Price set: ₹${total.toLocaleString('en-IN')}`,
      notes || `Token: ₹${token.toLocaleString('en-IN')}`, {}
    );

    res.json({ success: true, total, token_amount: token, invoice_number: invoice });
  } catch (err) {
    console.error('setPricing:', err);
    res.status(500).json({ error: 'Failed to set pricing' });
  }
};

// ── POST /api/payments/move/:moveId/token  (customer) ─────────
// Customer submits token payment (offline — UPI screenshot ref etc.)
exports.initiateToken = async (req, res) => {
  const { moveId } = req.params;
  const { payment_mode = 'upi', transaction_ref, notes } = req.body;

  try {
    const moveRes = await db.query(
      'SELECT * FROM moves WHERE id=$1 AND user_id=$2', [moveId, req.user.id]
    );
    const move = moveRes.rows[0];
    if (!move) return res.status(404).json({ error: 'Move not found' });
    if (move.token_paid) return res.status(400).json({ error: 'Token already paid' });

    const tokenAmount = parseFloat(move.token_amount || 0);
    if (tokenAmount <= 0) {
      return res.status(400).json({
        error: 'Price not yet set by admin. Please wait for pricing confirmation.',
        code: 'PRICE_NOT_SET'
      });
    }

    const paymentId = uuidv4();
    await db.query(
      `INSERT INTO payments
         (id, move_id, user_id, amount, payment_mode, status, payment_type, notes, transaction_id)
       VALUES ($1,$2,$3,$4,$5,'under_verification','token',$6,$7)`,
      [paymentId, moveId, req.user.id, tokenAmount, payment_mode,
       notes || null, transaction_ref || null]
    );

    await db.query(
      `UPDATE moves SET status='payment_under_verification',
         payment_status='under_verification', updated_at=NOW()
       WHERE id=$1`,
      [moveId]
    );

    // Notify admins
    const admins = await db.query(`SELECT id FROM users WHERE role='admin'`);
    for (const admin of admins.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'token_pending','💰 Token Payment Received',$3)`,
        [admin.id, moveId,
         `₹${tokenAmount.toLocaleString('en-IN')} token for "${move.title}" — please verify.`]
      );
    }

    await activities.create(moveId, req.user.id, 'customer', 'token_initiated',
      `Token payment of ₹${tokenAmount.toLocaleString('en-IN')} submitted`,
      `Mode: ${payment_mode}${transaction_ref ? ` · Ref: ${transaction_ref}` : ''}`, {}
    );

    res.json({
      success: true,
      payment_id: paymentId,
      token_amount: tokenAmount,
      message: `Token of ₹${tokenAmount.toLocaleString('en-IN')} submitted. Awaiting admin verification.`,
    });
  } catch (err) {
    console.error('initiateToken:', err);
    res.status(500).json({ error: 'Failed to submit token payment' });
  }
};

// ── POST /api/payments/move/:moveId/verify-token  (admin) ─────
// Admin verifies token → activates move, optionally assigns agent
exports.verifyToken = async (req, res) => {
  const { moveId } = req.params;
  const { action, agent_id, notes } = req.body; // action: approve | reject

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const payRes = await client.query(
      `SELECT * FROM payments
       WHERE move_id=$1 AND payment_type='token' AND status='under_verification'
       ORDER BY created_at DESC LIMIT 1`,
      [moveId]
    );
    const payment = payRes.rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No pending token payment found' });
    }

    const moveRes = await client.query('SELECT * FROM moves WHERE id=$1', [moveId]);
    const move = moveRes.rows[0];

    if (action === 'approve') {
      await client.query(
        `UPDATE payments SET status='verified', verified_by=$1, verified_at=NOW() WHERE id=$2`,
        [req.user.id, payment.id]
      );

      const setCols = agent_id
        ? `token_paid=TRUE, token_paid_at=NOW(), status='active',
           payment_status='token_verified', amount_paid=$1, agent_id=$2, updated_at=NOW()`
        : `token_paid=TRUE, token_paid_at=NOW(), status='active',
           payment_status='token_verified', amount_paid=$1, updated_at=NOW()`;
      const setParams = agent_id
        ? [payment.amount, agent_id, moveId]
        : [payment.amount, moveId];

      await client.query(`UPDATE moves SET ${setCols} WHERE id=$${setParams.length}`, setParams);

      // Notify customer
      await client.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'move_activated','🎉 Booking Confirmed!',$3)`,
        [move.user_id, moveId,
         `Your move "${move.title}" is now active. An agent will visit for final estimation.`]
      );

      if (agent_id) {
        await client.query(
          `INSERT INTO notifications (user_id, move_id, type, title, body)
           VALUES ($1,$2,'move_assigned','📋 New Move Assigned',$3)`,
          [agent_id, moveId, `You have been assigned to "${move.title}". Please visit and submit your final quote.`]
        );
      }

      await activities.create(moveId, req.user.id, 'admin', 'token_verified',
        'Token verified — Move activated',
        agent_id ? 'Agent assigned' : 'No agent assigned yet', {}
      );
    } else {
      await client.query(
        `UPDATE payments SET status='failed', verified_by=$1, verified_at=NOW() WHERE id=$2`,
        [req.user.id, payment.id]
      );
      await client.query(
        `UPDATE moves SET status='payment_pending', payment_status='failed', updated_at=NOW() WHERE id=$1`,
        [moveId]
      );
      await client.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'payment_failed','❌ Token Payment Rejected',$3)`,
        [move.user_id, moveId,
         `Token payment for "${move.title}" was not verified. ${notes || 'Please re-submit with correct details.'}`]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, action });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyToken:', err);
    res.status(500).json({ error: 'Failed to verify token' });
  } finally {
    client.release();
  }
};

// ── POST /api/payments/move/:moveId/pay-balance  (customer) ───
// Customer pays remaining balance after agent submits final quote
exports.payBalance = async (req, res) => {
  const { moveId } = req.params;
  const { payment_mode = 'upi', transaction_ref, notes } = req.body;

  try {
    const moveRes = await db.query(
      `SELECT m.*, aq.total as quoted_total
       FROM moves m
       LEFT JOIN agent_quotes aq ON aq.move_id = m.id
       WHERE m.id=$1 AND m.user_id=$2`,
      [moveId, req.user.id]
    );
    const move = moveRes.rows[0];
    if (!move) return res.status(404).json({ error: 'Move not found' });

    const finalTotal  = parseFloat(move.quoted_total || move.final_amount || move.amount_total || 0);
    const alreadyPaid = parseFloat(move.amount_paid || 0);
    const balanceDue  = Math.max(0, finalTotal - alreadyPaid);

    if (balanceDue <= 0) return res.status(400).json({ error: 'No balance due' });

    const paymentId = uuidv4();
    await db.query(
      `INSERT INTO payments
         (id, move_id, user_id, amount, payment_mode, status, payment_type, notes, transaction_id)
       VALUES ($1,$2,$3,$4,$5,'under_verification','balance',$6,$7)`,
      [paymentId, moveId, req.user.id, balanceDue, payment_mode, notes || null, transaction_ref || null]
    );

    await db.query(
      `UPDATE moves SET status='payment_under_verification',
         payment_status='under_verification', updated_at=NOW()
       WHERE id=$1`,
      [moveId]
    );

    const admins = await db.query(`SELECT id FROM users WHERE role='admin'`);
    for (const admin of admins.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'balance_pending','💰 Balance Payment Received',$3)`,
        [admin.id, moveId,
         `₹${balanceDue.toLocaleString('en-IN')} balance for "${move.title}" — please verify.`]
      );
    }

    await activities.create(moveId, req.user.id, 'customer', 'balance_submitted',
      `Balance payment of ₹${balanceDue.toLocaleString('en-IN')} submitted`,
      `Mode: ${payment_mode}`, {}
    );

    res.json({
      success: true,
      payment_id: paymentId,
      balance_amount: balanceDue,
      message: `Balance of ₹${balanceDue.toLocaleString('en-IN')} submitted. Awaiting verification.`,
    });
  } catch (err) {
    console.error('payBalance:', err);
    res.status(500).json({ error: 'Failed to submit balance payment' });
  }
};

// ── POST /api/payments/move/:moveId/verify-balance  (admin) ───
// Admin verifies balance payment → moves status to in_progress
exports.verifyBalance = async (req, res) => {
  const { moveId } = req.params;
  const { action, notes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const payRes = await client.query(
      `SELECT * FROM payments
       WHERE move_id=$1 AND payment_type='balance' AND status='under_verification'
       ORDER BY created_at DESC LIMIT 1`,
      [moveId]
    );
    const payment = payRes.rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No pending balance payment found' });
    }

    const moveRes = await client.query('SELECT * FROM moves WHERE id=$1', [moveId]);
    const move = moveRes.rows[0];

    if (action === 'approve') {
      await client.query(
        `UPDATE payments SET status='verified', verified_by=$1, verified_at=NOW() WHERE id=$2`,
        [req.user.id, payment.id]
      );
      const newPaid = parseFloat(move.amount_paid || 0) + parseFloat(payment.amount);
      await client.query(
        `UPDATE moves SET amount_paid=$1, payment_status='fully_paid',
           status='in_progress', updated_at=NOW()
         WHERE id=$2`,
        [newPaid, moveId]
      );
      await client.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'payment_complete','✅ Full Payment Confirmed',$3)`,
        [move.user_id, moveId,
         `Your balance payment for "${move.title}" is verified. Your move is now in progress!`]
      );
      await activities.create(moveId, req.user.id, 'admin', 'balance_verified',
        'Balance payment verified — Move in progress', '', {}
      );
    } else {
      await client.query(
        `UPDATE payments SET status='failed', verified_by=$1, verified_at=NOW() WHERE id=$2`,
        [req.user.id, payment.id]
      );
      await client.query(
        `UPDATE moves SET status='active', payment_status='token_verified', updated_at=NOW() WHERE id=$1`,
        [moveId]
      );
      await client.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'payment_failed','❌ Balance Payment Rejected',$3)`,
        [move.user_id, moveId,
         `Balance payment for "${move.title}" was not verified. ${notes || 'Please re-submit.'}`]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, action });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyBalance:', err);
    res.status(500).json({ error: 'Failed to verify balance' });
  } finally {
    client.release();
  }
};
