const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const activities = require('./activitiesController');

// ─────────────────────────────────────────────────────────────
// AGENT FLOW:
//  1. Agent visits site → submits total amount needed from customer
//  2. Agent marks token/partial received  → move stays active
//     OR
//     Agent marks full payment received   → move goes in_progress
// No admin verification needed for agent-collected cash payments.
// ─────────────────────────────────────────────────────────────

// ── POST /api/quotes/move/:moveId  (agent/admin) ──────────────
// Agent submits on-site quote with a single total_amount.
// Optionally still accepts itemised breakdown.
exports.submitQuote = async (req, res) => {
  const { moveId } = req.params;
  const {
    total_amount,           // required — what agent tells customer to pay
    base_price,             // optional breakdown
    floor_charge  = 0,
    fragile_charge = 0,
    extra_items   = 0,
    discount      = 0,
    notes,
    items_snapshot,
    include_tax   = true,   // default: total_amount is tax-inclusive
  } = req.body;

  if (!total_amount || parseFloat(total_amount) <= 0) {
    return res.status(400).json({ error: 'total_amount is required' });
  }

  try {
    const moveRes = await db.query(
      `SELECT * FROM moves WHERE id=$1 AND (agent_id=$2 OR $3='admin')`,
      [moveId, req.user.id, req.user.role]
    );
    const move = moveRes.rows[0];
    if (!move) return res.status(404).json({ error: 'Move not found or not assigned to you' });

    const total = parseFloat(total_amount);

    // If breakdown provided, calculate; otherwise treat total_amount as the final number
    let subtotal, tax;
    if (base_price && parseFloat(base_price) > 0) {
      subtotal = parseFloat(base_price) + parseFloat(floor_charge)
               + parseFloat(fragile_charge) + parseFloat(extra_items)
               - parseFloat(discount);
      tax = Math.round(subtotal * 0.18);
    } else {
      // Reverse-calc from total (total is tax-inclusive)
      subtotal = include_tax ? Math.round(total / 1.18) : total;
      tax      = total - subtotal;
    }

    // Upsert — one active quote per move
    const existing = await db.query('SELECT id FROM agent_quotes WHERE move_id=$1', [moveId]);
    let quoteId;
    if (existing.rows[0]) {
      quoteId = existing.rows[0].id;
      await db.query(
        `UPDATE agent_quotes SET
           agent_id=$1, base_price=$2, floor_charge=$3, fragile_charge=$4,
           extra_items=$5, discount=$6, subtotal=$7, tax=$8, total=$9,
           notes=$10, items_snapshot=$11, submitted_at=NOW()
         WHERE id=$12`,
        [req.user.id, base_price || subtotal, floor_charge, fragile_charge,
         extra_items, discount, subtotal, tax, total,
         notes || null, items_snapshot ? JSON.stringify(items_snapshot) : null, quoteId]
      );
    } else {
      quoteId = uuidv4();
      await db.query(
        `INSERT INTO agent_quotes
           (id, move_id, agent_id, base_price, floor_charge, fragile_charge,
            extra_items, discount, subtotal, tax, total, notes, items_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [quoteId, moveId, req.user.id, base_price || subtotal, floor_charge,
         fragile_charge, extra_items, discount, subtotal, tax, total,
         notes || null, items_snapshot ? JSON.stringify(items_snapshot) : null]
      );
    }

    // Update move: set final_amount, quote_status, also update amount_total to match
    await db.query(
      `UPDATE moves SET
         final_amount=$1, amount_total=$1, quote_status='submitted', updated_at=NOW()
       WHERE id=$2`,
      [total, moveId]
    );

    const alreadyPaid = parseFloat(move.amount_paid || 0);
    const balanceDue  = Math.max(0, total - alreadyPaid);

    // Notify customer
    await db.query(
      `INSERT INTO notifications (user_id, move_id, type, title, body)
       VALUES ($1,$2,'quote_submitted','📋 Final Amount Confirmed',$3)`,
      [move.user_id, moveId,
       `Your agent has confirmed the total: ₹${total.toLocaleString('en-IN')}. Balance due: ₹${balanceDue.toLocaleString('en-IN')}.`]
    );

    await activities.create(moveId, req.user.id, 'agent', 'quote_submitted',
      `Quote submitted: ₹${total.toLocaleString('en-IN')}`,
      notes || '', { quote_id: quoteId, total, balance_due: balanceDue }
    );

    res.json({ success: true, quote_id: quoteId, total, subtotal, tax, balance_due: balanceDue });
  } catch (err) {
    console.error('submitQuote:', err);
    res.status(500).json({ error: 'Failed to submit quote' });
  }
};


// ── POST /api/quotes/move/:moveId/mark-payment  (agent) ───────
// Agent marks payment received from customer on-site.
// payment_type: 'token' | 'full'
// No admin verification needed — agent is trusted for cash collection.
exports.markPaymentReceived = async (req, res) => {
  const { moveId } = req.params;
  const {
    payment_type,   // 'token' or 'full'
    amount,
    payment_mode = 'cash',
    notes,
    transaction_ref,
  } = req.body;

  if (!['token', 'full'].includes(payment_type)) {
    return res.status(400).json({ error: "payment_type must be 'token' or 'full'" });
  }
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'amount is required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const moveRes = await client.query(
      `SELECT * FROM moves WHERE id=$1 AND (agent_id=$2 OR $3='admin')`,
      [moveId, req.user.id, req.user.role]
    );
    const move = moveRes.rows[0];
    if (!move) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Move not found or not assigned to you' });
    }

    const amountReceived = parseFloat(amount);
    const newAmountPaid  = parseFloat(move.amount_paid || 0) + amountReceived;
    const finalTotal     = parseFloat(move.final_amount || move.amount_total || 0);

    // Record payment — auto-verified since agent is collecting directly
    const paymentId = uuidv4();
    await client.query(
      `INSERT INTO payments
         (id, move_id, user_id, amount, payment_mode, status,
          payment_type, notes, transaction_id, verified_by, verified_at)
       VALUES ($1,$2,$3,$4,$5,'verified',$6,$7,$8,$9,$9,$10)`,
      [paymentId, moveId, move.user_id, amountReceived, payment_mode,
       payment_type, notes || null, transaction_ref || null,
       req.user.id, new Date()]
    );

    let newStatus, newPaymentStatus, notifTitle, notifBody;

    if (payment_type === 'full') {
      // Full payment — move to in_progress immediately
      newStatus        = 'in_progress';
      newPaymentStatus = 'fully_paid';
      notifTitle = '✅ Full Payment Received';
      notifBody  = `Your full payment of ₹${amountReceived.toLocaleString('en-IN')} has been received. Your move is now in progress!`;
    } else {
      // Token payment — move stays active, balance still due
      const tokenPaidAlready = move.token_paid;
      newStatus        = 'active';
      newPaymentStatus = tokenPaidAlready ? 'token_verified' : 'token_verified';
      notifTitle = '🎉 Token Payment Received';
      notifBody  = `Your token of ₹${amountReceived.toLocaleString('en-IN')} has been received. Balance due: ₹${Math.max(0, finalTotal - newAmountPaid).toLocaleString('en-IN')}.`;
    }

    await client.query(
      `UPDATE moves SET
         amount_paid=$1, token_paid=(token_paid OR $2),
         token_paid_at=COALESCE(token_paid_at, $3),
         status=$4, payment_status=$5, updated_at=NOW()
       WHERE id=$6`,
      [
        newAmountPaid,
        payment_type === 'token',
        payment_type === 'token' ? new Date() : null,
        newStatus,
        newPaymentStatus,
        moveId,
      ]
    );

    // Notify customer
    await client.query(
      `INSERT INTO notifications (user_id, move_id, type, title, body)
       VALUES ($1,$2,'payment_received',$3,$4)`,
      [move.user_id, moveId, notifTitle, notifBody]
    );

    // Notify admins
    const admins = await client.query(`SELECT id FROM users WHERE role='admin'`);
    for (const admin of admins.rows) {
      await client.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body)
         VALUES ($1,$2,'agent_payment_marked','💰 Agent Marked Payment',$3)`,
        [admin.id, moveId,
         `Agent marked ${payment_type} payment of ₹${amountReceived.toLocaleString('en-IN')} for "${move.title}".`]
      );
    }

    await activities.create(moveId, req.user.id, 'agent',
      payment_type === 'full' ? 'full_payment_received' : 'token_payment_received',
      `${payment_type === 'full' ? 'Full' : 'Token'} payment received: ₹${amountReceived.toLocaleString('en-IN')}`,
      `Mode: ${payment_mode}${transaction_ref ? ` · Ref: ${transaction_ref}` : ''}`, {}
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      payment_id: paymentId,
      amount_received: amountReceived,
      total_paid: newAmountPaid,
      move_status: newStatus,
      payment_status: newPaymentStatus,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('markPaymentReceived:', err);
    res.status(500).json({ error: 'Failed to mark payment' });
  } finally {
    client.release();
  }
};


// ── GET /api/quotes/move/:moveId ──────────────────────────────
exports.getQuote = async (req, res) => {
  try {
    const q = await db.query(
      `SELECT aq.*, u.name as agent_name, u.phone as agent_phone
       FROM agent_quotes aq
       LEFT JOIN users u ON u.id = aq.agent_id
       WHERE aq.move_id=$1 ORDER BY aq.submitted_at DESC LIMIT 1`,
      [req.params.moveId]
    );
    res.json(q.rows[0] || null);
  } catch (err) {
    console.error('getQuote:', err);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
};
