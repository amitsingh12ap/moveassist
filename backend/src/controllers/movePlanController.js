const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const activities = require('./activitiesController');

// ── POST /api/plans/move/:moveId  (agent/admin) ───────────────
exports.savePlan = async (req, res) => {
  const { moveId } = req.params;
  const b = req.body;

  // Map new field names to old schema
  const package_type         = b.package_type || 'standard';
  const vehicle_type         = b.vehicle_type || null;
  const vehicle_number       = b.vehicle_number || null;
  const movers_count         = parseInt(b.movers_count || 2);
  const team_lead_name       = b.team_lead_name || null;
  const team_lead_phone      = b.team_lead_phone || null;

  // Packing materials as JSON array
  const packing_materials = [];
  if (b.packing_boxes && parseInt(b.packing_boxes) > 0) 
    packing_materials.push({ item: 'Boxes', qty: parseInt(b.packing_boxes) });
  if (b.bubble_wrap_meters && parseInt(b.bubble_wrap_meters) > 0) 
    packing_materials.push({ item: 'Bubble Wrap (m)', qty: parseInt(b.bubble_wrap_meters) });
  if (b.packing_tape_rolls && parseInt(b.packing_tape_rolls) > 0) 
    packing_materials.push({ item: 'Tape Rolls', qty: parseInt(b.packing_tape_rolls) });
  if (b.stretch_wrap_rolls && parseInt(b.stretch_wrap_rolls) > 0) 
    packing_materials.push({ item: 'Stretch Wrap Rolls', qty: parseInt(b.stretch_wrap_rolls) });
  if (b.furniture_blankets && parseInt(b.furniture_blankets) > 0) 
    packing_materials.push({ item: 'Furniture Blankets', qty: parseInt(b.furniture_blankets) });
  if (b.custom_materials) 
    packing_materials.push({ item: b.custom_materials, qty: 1 });

  // Schedule - old schema uses timestamp columns
  const packing_start_at     = b.packing_start_at || null;
  const pickup_at            = b.pickup_at || null;
  const pickup_slot          = b.pickup_slot || null;
  const estimated_delivery   = b.estimated_delivery || null;

  const special_instructions = b.special_instructions || null;
  const internal_notes       = b.internal_notes || null;

  // Old schema uses 'published' boolean instead of 'plan_status'
  const published = b.publish === true;

  try {
    const moveRes = await db.query(
      `SELECT * FROM moves WHERE id=$1 AND (agent_id=$2 OR $3='admin')`,
      [moveId, req.user.id, req.user.role]
    );
    if (!moveRes.rows[0]) return res.status(404).json({ error: 'Move not found or not assigned to you' });
    const move = moveRes.rows[0];

    const existing = await db.query('SELECT id FROM move_plans WHERE move_id=$1', [moveId]);

    if (existing.rows[0]) {
      await db.query(
        `UPDATE move_plans SET
           agent_id=$1, package_type=$2, vehicle_type=$3, vehicle_number=$4,
           movers_count=$5, team_lead_name=$6, team_lead_phone=$7,
           packing_materials=$8, packing_start_at=$9, pickup_at=$10,
           pickup_slot=$11, estimated_delivery=$12,
           special_instructions=$13, internal_notes=$14, published=$15,
           updated_at=NOW()
         WHERE move_id=$16`,
        [req.user.id, package_type, vehicle_type, vehicle_number,
         movers_count, team_lead_name, team_lead_phone,
         JSON.stringify(packing_materials), packing_start_at, pickup_at,
         pickup_slot, estimated_delivery,
         special_instructions, internal_notes, published, moveId]
      );
    } else {
      await db.query(
        `INSERT INTO move_plans (move_id,agent_id,package_type,vehicle_type,vehicle_number,
           movers_count,team_lead_name,team_lead_phone,packing_materials,
           packing_start_at,pickup_at,pickup_slot,estimated_delivery,
           special_instructions,internal_notes,published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [moveId, req.user.id, package_type, vehicle_type, vehicle_number,
         movers_count, team_lead_name, team_lead_phone, JSON.stringify(packing_materials),
         packing_start_at, pickup_at, pickup_slot, estimated_delivery,
         special_instructions, internal_notes, published]
      );
    }

    if (published) {
      const pickupStr = pickup_at
        ? `on ${new Date(pickup_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}`
        : 'soon';
      await db.query(
        `INSERT INTO notifications (user_id, move_id, type, title, body) VALUES ($1,$2,'plan_confirmed','📦 Your Move Plan is Ready',$3)`,
        [move.user_id, moveId,
         `Your agent has finalized the move plan. Pickup ${pickupStr}. Check the payment screen for full details.`]
      );
    }

    await activities.create(moveId, req.user.id, 'agent',
      published ? 'plan_confirmed' : 'plan_updated',
      published ? 'Move plan confirmed' : 'Move plan saved as draft',
      special_instructions || '', {}
    );

    res.json({ success: true, published });
  } catch (err) {
    console.error('savePlan error:', err);
    res.status(500).json({ error: 'Failed to save move plan: ' + err.message });
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
