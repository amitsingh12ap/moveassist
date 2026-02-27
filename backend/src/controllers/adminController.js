const db = require('../../config/db');
const bcrypt = require('bcryptjs');

// ── DASHBOARD STATS ──────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [moves, revenue, pending, users, agents] = await Promise.all([
      db.query(`SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='active') as active,
        COUNT(*) FILTER (WHERE status='in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status='completed') as completed,
        COUNT(*) FILTER (WHERE payment_status='pending') as unpaid,
        COUNT(*) FILTER (WHERE payment_status='under_verification') as under_verification
        FROM moves`),
      db.query(`SELECT 
        COALESCE(SUM(amount) FILTER (WHERE status='verified'), 0) as collected,
        COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0) as pending_amount
        FROM payments`),
      db.query(`SELECT COUNT(*) as count FROM payments WHERE status='pending' AND payment_mode IN ('cash','upi_offline','cheque','bank_transfer')`),
      db.query(`SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role='customer') as customers,
        COUNT(*) FILTER (WHERE role='agent') as agents,
        COUNT(*) FILTER (WHERE role='admin') as admins
        FROM users`),
      db.query(`SELECT id, name, email FROM users WHERE role='agent' ORDER BY name`),
    ]);
    res.json({
      moves: moves.rows[0],
      revenue: revenue.rows[0],
      pending_verifications: parseInt(pending.rows[0].count),
      users: users.rows[0],
      agents: agents.rows,
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

// ── ALL MOVES ────────────────────────────────────────────────
exports.getMoves = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, 
        u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
        a.name as agent_name,
        COALESCE((SELECT COUNT(*) FROM boxes WHERE move_id=m.id), 0) as total_boxes,
        mp.total as invoice_total,
        COALESCE((SELECT SUM(amount) FROM payments WHERE move_id=m.id AND status='verified'), 0) as amount_collected
      FROM moves m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN users a ON a.id = m.agent_id
      LEFT JOIN move_pricing mp ON mp.move_id = m.id
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({ error: 'Failed to get moves' });
  }
};

// ── ASSIGN AGENT ─────────────────────────────────────────────
exports.assignAgent = async (req, res) => {
  const { agent_id } = req.body;
  try {
    const result = await db.query(
      `UPDATE moves SET agent_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [agent_id || null, req.params.id]
    );
    const move = result.rows[0];
    let agent = null;
    if (agent_id) {
      const agentResult = await db.query('SELECT id, name, email, phone FROM users WHERE id=$1', [agent_id]);
      agent = agentResult.rows[0] || null;
      // Notify agent
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body, move_id)
         VALUES ($1, 'move_assigned', 'New Move Assigned', $2, $3)`,
        [agent_id, `You have been assigned to move: ${move.title || 'Untitled'}`, move.id]
      ).catch(() => {});
      // Notify customer
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body, move_id)
         VALUES ($1, 'agent_assigned', 'Agent Assigned to Your Move', $2, $3)`,
        [move.user_id, `${agent.name} has been assigned to handle your move.`, move.id]
      ).catch(() => {});
    }
    res.json({ ...move, agent });
  } catch(err) {
    res.status(500).json({ error: 'Failed to assign agent' });
  }
};

// ── FORCE ACTIVATE ───────────────────────────────────────────
exports.forceActivate = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE moves SET status='active', payment_status='waived', updated_at=NOW()
       WHERE id=$1 AND status IN ('payment_pending','payment_under_verification','created')
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Move not found or already active' });
    const move = result.rows[0];
    // Notify customer
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, move_id)
       VALUES ($1, 'move_created', 'Move Activated', 'Your move has been activated by admin.', $2)`,
      [move.user_id, move.id]
    ).catch(() => {});
    res.json(move);
  } catch(err) {
    res.status(500).json({ error: 'Failed to force-activate move' });
  }
};

// ── UPDATE MOVE STATUS ───────────────────────────────────────
exports.updateMoveStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ['payment_pending','active','in_progress','completed','closed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const result = await db.query(
      `UPDATE moves SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// ── PENDING PAYMENT VERIFICATIONS ───────────────────────────
exports.getPendingPayments = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*,
        m.title as move_title, m.from_address, m.to_address,
        u.name as customer_name, u.email as customer_email,
        rb.name as recorded_by_name
      FROM payments p
      JOIN moves m ON m.id = p.move_id
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users rb ON rb.id = p.recorded_by
      WHERE p.status IN ('pending','under_verification')
      ORDER BY p.created_at ASC
    `);
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({ error: 'Failed to get pending payments' });
  }
};

// ── ALL PAYMENTS ─────────────────────────────────────────────
exports.getPayments = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*,
        m.title as move_title, m.from_address, m.to_address,
        u.name as customer_name, u.email as customer_email,
        rb.name as recorded_by_name
      FROM payments p
      JOIN moves m ON m.id = p.move_id
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users rb ON rb.id = p.recorded_by
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({ error: 'Failed to get payments' });
  }
};

// ── ADMIN MARK MOVE AS PAID ──────────────────────────────────
exports.markMovePaid = async (req, res) => {
  const { amount, payment_mode = 'admin_override', notes } = req.body;
  if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const move = await client.query('SELECT * FROM moves WHERE id=$1', [req.params.id]);
    if (!move.rows[0]) throw new Error('Move not found');
    const m = move.rows[0];
    await client.query(
      `INSERT INTO payments (move_id, user_id, amount, payment_mode, status, notes, recorded_by, verified_by, verified_at)
       VALUES ($1,$2,$3,$4,'verified',$5,$6,$6,NOW())`,
      [m.id, m.user_id, amount, payment_mode, notes || 'Marked paid by admin', req.user.id]
    );
    const newMoveStatus = m.status === 'payment_pending' ? 'active' : m.status;
    await client.query(
      `UPDATE moves SET payment_status='verified', status=$1, activated_at=COALESCE(activated_at,NOW()), updated_at=NOW() WHERE id=$2`,
      [newMoveStatus, m.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, move_status: newMoveStatus });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to mark move as paid' });
  } finally {
    client.release();
  }
};

// ── VERIFY / REJECT PAYMENT ──────────────────────────────────
exports.verifyPayment = async (req, res) => {
  const { action, notes } = req.body; // action: 'approve' | 'reject'
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const newStatus = action === 'approve' ? 'verified' : 'rejected';
    await client.query(
      `UPDATE payments SET status=$1, verified_by=$2, verified_at=NOW(), notes=COALESCE($3,notes)
       WHERE id=$4`,
      [newStatus, req.user.id, notes, req.params.id]
    );
    if (action === 'approve') {
      // Check if fully paid
      const paymentRow = await client.query('SELECT move_id FROM payments WHERE id=$1', [req.params.id]);
      const moveId = paymentRow.rows[0].move_id;
      const totals = await client.query(
        `SELECT mp.total, COALESCE(SUM(p.amount) FILTER (WHERE p.status='verified'), 0) as paid
         FROM move_pricing mp
         LEFT JOIN payments p ON p.move_id=mp.move_id AND p.status='verified'
         WHERE mp.move_id=$1 GROUP BY mp.total`,
        [moveId]
      );
      if (totals.rows.length && parseFloat(totals.rows[0].paid) >= parseFloat(totals.rows[0].total)) {
        await client.query(
          `UPDATE moves SET payment_status='verified', status='active', activated_at=NOW(), updated_at=NOW() WHERE id=$1`,
          [moveId]
        );
        // Update all pending payments to under_verification → verified
        await client.query(
          `UPDATE payments SET status='verified' WHERE move_id=$1 AND status='pending'`,
          [moveId]
        );
      } else {
        await client.query(
          `UPDATE moves SET payment_status='partial', updated_at=NOW() WHERE id=$1`,
          [moveId]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, action });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to verify payment' });
  } finally {
    client.release();
  }
};

// ── ALL USERS ────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
        COALESCE(COUNT(m.id), 0)::integer as total_moves
      FROM users u
      LEFT JOIN moves m ON m.user_id = u.id
      GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch(err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to get users: ' + err.message });
  }
};

// ── CHANGE USER ROLE ─────────────────────────────────────────
exports.updateUserRole = async (req, res) => {
  // Roles are permanent and cannot be changed once assigned
  return res.status(403).json({ 
    error: 'Role changes are disabled. Roles are permanent once assigned. Please delete and recreate the user if needed.' 
  });
};

// ── CREATE AGENT ACCOUNT ─────────────────────────────────────
exports.createAgent = async (req, res) => {
  const { name, email, password, phone, role = 'agent' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  
  // Validate role
  const validRoles = ['agent', 'admin', 'customer'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role. Must be agent, admin, or customer' });
  
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role`,
      [name, email, hash, phone, role]
    );
    res.status(201).json(result.rows[0]);
  } catch(err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: `Failed to create ${role}` });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Check if user exists
    const userCheck = await client.query('SELECT role, email, name FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userCheck.rows[0];
    console.log(`Attempting to delete user: ${user.name} (${user.email}) - Role: ${user.role}`);
    
    // Prevent deletion of admin accounts
    if (user.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cannot delete admin accounts. Only agents and customers can be deleted.' });
    }
    
    // Delete related records first to avoid FK constraint violations
    
    // 1. Delete box scans created by this user
    const boxScans = await client.query('DELETE FROM box_scans WHERE scanned_by = $1', [id]);
    console.log(`  Deleted ${boxScans.rowCount} box scans created by user`);
    
    // 2. Update moves - set agent_id to NULL if this user was an agent
    const agentMoves = await client.query('UPDATE moves SET agent_id = NULL WHERE agent_id = $1', [id]);
    console.log(`  Updated ${agentMoves.rowCount} moves (unassigned agent)`);
    
    // 3. Delete notifications for this user
    const notifs = await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    console.log(`  Deleted ${notifs.rowCount} notifications`);
    
    // 4. For customer users, we need to handle their moves
    if (user.role === 'customer') {
      console.log(`  User is customer - deleting related move data...`);
      
      // Delete disputes first
      const disputes = await client.query('DELETE FROM disputes WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1)', [id]);
      console.log(`    Deleted ${disputes.rowCount} disputes`);
      
      // Delete payments
      const payments = await client.query('DELETE FROM payments WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1)', [id]);
      console.log(`    Deleted ${payments.rowCount} payments`);
      
      // Delete move_items if table exists
      try {
        const items = await client.query('DELETE FROM move_items WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1)', [id]);
        console.log(`    Deleted ${items.rowCount} move items`);
      } catch(e) {
        console.log(`    move_items table not found (skipping)`);
      }
      
      // Delete box_scans for moves
      const moveBoxScans = await client.query('DELETE FROM box_scans WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1)', [id]);
      console.log(`    Deleted ${moveBoxScans.rowCount} box scans for moves`);
      
      // Finally delete moves
      const moves = await client.query('DELETE FROM moves WHERE user_id = $1', [id]);
      console.log(`    Deleted ${moves.rowCount} moves`);
    }
    
    // 5. Delete activities
    const activities = await client.query('DELETE FROM activities WHERE user_id = $1', [id]);
    console.log(`  Deleted ${activities.rowCount} activities`);
    
    // 6. Delete the user
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    console.log(`✅ Successfully deleted user: ${user.name}`);
    
    await client.query('COMMIT');
    res.json({ message: 'User deleted successfully' });
    
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('❌ Delete user error:', err.message);
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  } finally {
    client.release();
  }
};
