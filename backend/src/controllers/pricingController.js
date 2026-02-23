const db = require('../../config/db');

// BHK-based base prices (₹)
const BHK_BASE = { '1bhk': 4999, '2bhk': 7999, '3bhk': 11999, '4bhk': 16999, 'studio': 2999 };
const ITEM_RATE = 150;       // per furniture item
const BOX_RATE = 80;         // per box
const FLOOR_RATE = 500;      // per floor (no lift)
const FRAGILE_SURCHARGE = 999;
const TAX = 0.18;

exports.estimate = async (req, res) => {
  const { bhk_type, num_furniture, num_boxes, floor_from, floor_to, has_lift_from, has_lift_to, has_fragile } = req.body;
  const base = BHK_BASE[bhk_type] || BHK_BASE['2bhk'];
  const itemCost = (parseInt(num_furniture) || 0) * ITEM_RATE + (parseInt(num_boxes) || 0) * BOX_RATE;
  const floorFrom = (!has_lift_from && floor_from > 0) ? floor_from * FLOOR_RATE : 0;
  const floorTo   = (!has_lift_to  && floor_to  > 0) ? floor_to  * FLOOR_RATE : 0;
  const fragile   = has_fragile ? FRAGILE_SURCHARGE : 0;
  const subtotal  = base + itemCost + floorFrom + floorTo + fragile;
  const tax       = Math.round(subtotal * TAX);
  const total     = subtotal + tax;
  res.json({
    breakdown: { base, itemCost, floorFrom, floorTo, fragile, subtotal, tax, total },
    bhk_type, display: `₹${total.toLocaleString('en-IN')}`
  });
};

exports.save = async (req, res) => {
  const { move_id, base_price, num_rooms, has_fragile, fragile_surcharge,
          floor_surcharge, tax_percent, discount, total } = req.body;
  const r = await db.query(
    `INSERT INTO move_pricing (move_id,base_price,num_rooms,has_fragile,fragile_surcharge,floor_surcharge,tax_percent,discount,total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (move_id) DO UPDATE SET base_price=$2,num_rooms=$3,has_fragile=$4,
       fragile_surcharge=$5,floor_surcharge=$6,tax_percent=$7,discount=$8,total=$9 RETURNING *`,
    [move_id, base_price, num_rooms, has_fragile||false, fragile_surcharge||0, floor_surcharge||0, tax_percent||18, discount||0, total]
  );
  await db.query('UPDATE moves SET estimated_cost=$1 WHERE id=$2', [total, move_id]);
  res.json(r.rows[0]);
};
