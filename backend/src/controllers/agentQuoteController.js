const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const activities = require('./activitiesController');

// ── POST /api/quotes/move/:moveId  (agent/admin) ──────────────
// Agent submits on-site quote. Customer automatically sees the
// updated balance to pay — no approval step required.
exports.submitQuote = async (req, res) => {
  const { moveId } = req.params;
  const {
    base_price, floor_charge = 0, fragile_charge = 0,
    extra_items = 0, discount = 0, notes, items_snapshot
  } = req.body;

  if (!base_price || parseFloat(base_price) <= 0) {
    return res.status(400).json({ error: 'base_price is required' });
  }

  try {
    const moveRes = await db.query(
      `SELECT * FROM moves WHERE id=$1 AND (agent_id=$2 OR $3='admin')`,
      [moveId, req.user.id, req.user.role]
    );
    const move = moveRes.rows[0];
    if (!move) return res.status(404).json({ error: 'Move not found or not assigned to you' });
    if (!move.token_paid) return res.status(400).json({ error: 'Token not yet verified for this move' });

    const subtotal = parseFloat(base_price) + parseFloat(floor_charge)
                   + parseFloat(fragile_charge) + parseFloat(extra_items)
                   - parseFloat(discount);
    const tax   = Math.round(subtotal * 0.18);
    const total = subtotal + tax;

    // Upsert — only one active quote per move
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
        [req.user.id, base_price, floor_charge, fragile_charge, extra_items,
         discount, subtotal, tax, total, notes || null,
         items_snapshot ? JSON.stringify(items_snapshot) : null, quoteId]
      );
    } else {
      quoteId = uuidv4();
      await db.query(
        `INSERT INTO agent_quotes
           (id, move_id, agent_id, base_price, floor_charge, fragile_charge,
            extra_items, discount, subtotal, tax, total, notes, items_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [quoteId, moveId, req.user.id, base_price, floor_charge, fragile_charge,
         extra_items, discount, subtotal, tax, total, notes || null,
         items_snapshot ? JSON.stringify(items_snapshot) : null]
      );
    }

    // Update move: final_amount + quote_status='submitted'
    await db.query(
      `UPDATE moves SET final_amount=$1, quote_status='submitted', updated_at=NOW() WHERE id=$2`,
      [total, moveId]
    );

    // Notify customer — balance now visible, no approval needed
    const balanceDue = Math.max(0, total - parseFloat(move.amount_paid || 0));
    await db.query(
      `INSERT INTO notifications (user_id, move_id, type, title, body)
       VALUES ($1,$2,'quote_submitted','📋 Final Price Ready',$3)`,
      [move.user_id, moveId,
       `Final cost: ₹${total.toLocaleString('en-IN')}. Balance due: ₹${balanceDue.toLocaleString('en-IN')}. You can now pay to complete your booking.`]
    );

    await activities.create(moveId, req.user.id, 'agent', 'quote_submitted',
      `Final quote submitted: ₹${total.toLocaleString('en-IN')}`,
      notes || '', { quote_id: quoteId, total, balance_due: balanceDue }
    );

    res.json({ success: true, quote_id: quoteId, total, subtotal, tax, balance_due: balanceDue });
  } catch (err) {
    console.error('submitQuote:', err);
    res.status(500).json({ error: 'Failed to submit quote' });
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
