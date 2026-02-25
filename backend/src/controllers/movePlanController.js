const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const activities = require('./activitiesController');

// ── POST /api/plans/move/:moveId  (agent/admin) ───────────────
exports.savePlan = async (req, res) => {
  const { moveId } = req.params;
  const b = req.body;

  // Accept both old field names (from PWA) and new canonical names
  const package_type         = b.package_type || null;
  const package_notes        = b.package_notes || null;
  const vehicle_type         = b.vehicle_type || null;
  const vehicle_number       = b.vehicle_number || null;
  const vehicle_count        = parseInt(b.vehicle_count || 1);
  const movers_count         = parseInt(b.movers_count || 0);
  const team_lead_name       = b.team_lead_name || null;
  const team_lead_phone      = b.team_lead_phone || null;

  // Packing materials: accept either structured counts OR JSON array => map to counts
  let packing_boxes       = parseInt(b.packing_boxes || 0);
  let bubble_wrap_meters  = parseInt(b.bubble_wrap_meters || 0);
  let packing_tape_rolls  = parseInt(b.packing_tape_rolls || 0);
  let stretch_wrap_rolls  = parseInt(b.stretch_wrap_rolls || 0);
  let furniture_blankets  = parseInt(b.furniture_blankets || 0);
  let custom_materials    = b.custom_materials || null;

  // If old-style packing_materials array was sent, extract quantities + dump rest to custom
  if (b.packing_materials && Array.isArray(b.packing_materials) && b.packing_materials.length) {
    const extras = [];
    for (const m of b.packing_materials) {
      const item = (typeof m === 'object' ? m.item : m || '').toLowerCase();
      const qty  = typeof m === 'object' && m.qty ? parseInt(m.qty) : 1;
      if (/box/.test(item))           packing_boxes       = packing_boxes || qty;
      else if (/bubble/.test(item))   bubble_wrap_meters  = bubble_wrap_meters || qty;
      else if (/tape/.test(item))     packing_tape_rolls  = packing_tape_rolls || qty;
      else if (/stretch|film/.test(item)) stretch_wrap_rolls = stretch_wrap_rolls || qty;
      else if (/blanket/.test(item))  furniture_blankets  = furniture_blankets || qty;
      else extras.push(typeof m === 'object' ? `${m.item}${m.qty ? ' ×'+m.qty : ''}` : m);
    }
    if (extras.length && !custom_materials) custom_materials = extras.join(', ');
  }

  // Schedule — accept both datetime-local strings and date-only strings
  const pickup_date        = b.pickup_at ? b.pickup_at.slice(0,10) : (b.pickup_date || null);
  const pickup_time_slot   = b.pickup_slot || b.pickup_time_slot || null;
  const pickup_time_custom = b.pickup_time_custom || null;
  const packing_start_time = b.packing_start_at || b.packing_start_time || null;
  const estimated_delivery = b.estimated_delivery ? b.estimated_delivery.slice(0,10) : null;

  const special_instructions = b.special_instructions || null;
  const internal_notes       = b.internal_notes || null;

  // Accept publish:true/false (legacy) or plan_status:'draft'|'confirmed'
  let plan_status = b.plan_status || (b.publish === true ? 'confirmed' : 'draft');

  try {
    const moveRes = await db.query(
      `SELECT * FROM moves WHERE id=$1 AND (agent_id=$2 OR $3='admin')`,
      [moveId, req.user.id, req.user.role]
    );
    if (!moveRes.rows[0]) return res.status(404).json({ error: 'Move not found or not assigned to you' });
    const move = moveRes.rows[0];

    const existing = await db.query('SELECT id FROM move_plans WHERE move_id=$1', [moveId]);
    const confirmedAt = plan_status === 'confirmed' ? new Date() : null;

    if (existing.rows[0]) {
      await db.query(
        `UPDATE move_plans SET
           agent_id=$1, package_type=$2, package_notes=$3,
           vehicle_type=$4, vehicle_number=$5, vehicle_count=$6,
           movers_count=$7, team_lead_name=$8, team_lead_phone=$9,
           packing_boxes=$10, bubble_wrap_meters=$11, packing_tape_rolls=$12,
           stretch_wrap_rolls=$13, furniture_blankets=$14, custom_materials=$15,
           pickup_date=$16, pickup_time_slot=$17, pickup_time_custom=$18,
           packing_start_time=$19, estimated_delivery=$20,
           special_instructions=$21, internal_notes=$22,
           plan_status=$23, confirmed_at=COALESCE($24, confirmed_at), updated_at=NOW()
         WHERE move_id=$25`,
        [req.user.id, package_type, package_notes, vehicle_type, vehicle_number, vehicle_count,
         movers_count, team_lead_name, team_lead_phone,
         packing_boxes, bubble_wrap_meters, packing_tape_rolls, stretch_wrap_rolls, furniture_blankets, custom_materials,
         pickup_date, pickup_time_slot, pickup_time_custom, packing_start_time, estimated_delivery,
         special_instructions, internal_notes, plan_status, confirmedAt, moveId]
      );
    } else {
      await db.query(
        `INSERT INTO move_plans (id,move_id,agent_id,package_type,package_notes,
           vehicle_type,vehicle_number,vehicle_count,movers_count,team_lead_name,team_lead_phone,
           packing_boxes,bubble_wrap_meters,packing_tape_rolls,stretch_wrap_rolls,furniture_blankets,custom_materials,
           pickup_date,pickup_time_slot,pickup_time_custom,packing_start_time,estimated_delivery,
           special_instructions,internal_notes,plan_status,confirmed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [uuidv4(), moveId, req.user.id, package_type, package_notes, vehicle_type, vehicle_number, vehicle_count,
         movers_count, team_lead_name, team_lead_phone,
         packing_boxes, bubble_wrap_meters, packing_tape_rolls, stretch_wrap_rolls, furniture_blankets, custom_materials,
         pickup_date, pickup_time_slot, pickup_time_custom, packing_start_time, estimated_delivery,
         special_instructions, internal_notes, plan_status, confirmedAt]
      );
    }

    if (plan_status === 'confirmed') {
      const pickupStr = pickup_date
        ? `on ${new Date(pickup_date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}`
        : 'soon';
      await db.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body) VALUES ($1,$2,'plan_confirmed','📦 Your Move Plan is Ready',$3)`,
        [move.user_id, moveId,
         `Your agent has finalized the move plan. Pickup ${pickupStr}. Check the payment screen for full details.`]
      );
    }

    await activities.create(moveId, req.user.id, 'agent',
      plan_status === 'confirmed' ? 'plan_confirmed' : 'plan_updated',
      plan_status === 'confirmed' ? 'Move plan confirmed' : 'Move plan saved as draft',
      special_instructions || '', {}
    );

    res.json({ success: true, plan_status });
  } catch (err) {
    console.error('savePlan:', err);
    res.status(500).json({ error: 'Failed to save move plan' });
  }
};

// ── GET /api/plans/move/:moveId ───────────────────────────────
exports.getPlan = async (req, res) => {
  try {
    const r = await db.query(
      `SELECT mp.*, u.name as agent_name, u.phone as agent_phone
       FROM move_plans mp LEFT JOIN users u ON u.id = mp.agent_id
       WHERE mp.move_id=$1`,
      [req.params.moveId]
    );
    res.json(r.rows[0] || null);
  } catch (err) {
    console.error('getPlan:', err);
    res.status(500).json({ error: 'Failed to fetch move plan' });
  }
};
