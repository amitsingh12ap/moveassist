// Test delete user function
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  database: 'moveassist',
  port: 5432
});

async function testDelete() {
  const client = await pool.connect();
  
  try {
    // Get the customer user ID
    const customerResult = await client.query(
      "SELECT id, name, email, role FROM users WHERE email = 'amit.singh12ap@gmail.com'"
    );
    
    if (customerResult.rows.length === 0) {
      console.log('❌ Customer not found');
      return;
    }
    
    const customer = customerResult.rows[0];
    console.log('📋 Found customer:', customer.name, '-', customer.email);
    console.log('🔑 Customer ID:', customer.id);
    
    // Now test the delete logic
    console.log('\n🗑️  Testing delete logic...\n');
    
    await client.query('BEGIN');
    
    const id = customer.id;
    
    // Check if user exists
    const userCheck = await client.query('SELECT role, email FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      console.log('❌ User not found in check');
      await client.query('ROLLBACK');
      return;
    }
    
    console.log('✅ User exists check passed');
    
    // Prevent deletion of admin accounts
    if (userCheck.rows[0].role === 'admin') {
      console.log('❌ Cannot delete admin');
      await client.query('ROLLBACK');
      return;
    }
    
    console.log('✅ Not an admin, can delete');
    
    // Delete related records
    console.log('\n🧹 Cleaning up related records...');
    
    const boxScans1 = await client.query('DELETE FROM box_scans WHERE scanned_by = $1 RETURNING id', [id]);
    console.log(`  ✅ Deleted ${boxScans1.rowCount} box scans (scanned_by)`);
    
    const moves1 = await client.query('UPDATE moves SET assigned_agent = NULL WHERE assigned_agent = $1 RETURNING id', [id]);
    console.log(`  ✅ Updated ${moves1.rowCount} moves (assigned_agent)`);
    
    const notifs = await client.query('DELETE FROM notifications WHERE user_id = $1 RETURNING id', [id]);
    console.log(`  ✅ Deleted ${notifs.rowCount} notifications`);
    
    if (userCheck.rows[0].role === 'customer') {
      console.log('\n👤 Customer-specific cleanup...');
      
      const disputes = await client.query('DELETE FROM disputes WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1) RETURNING id', [id]);
      console.log(`  ✅ Deleted ${disputes.rowCount} disputes`);
      
      const payments = await client.query('DELETE FROM payments WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1) RETURNING id', [id]);
      console.log(`  ✅ Deleted ${payments.rowCount} payments`);
      
      const boxScans2 = await client.query('DELETE FROM box_scans WHERE move_id IN (SELECT id FROM moves WHERE user_id = $1) RETURNING id', [id]);
      console.log(`  ✅ Deleted ${boxScans2.rowCount} box scans (for moves)`);
      
      const moves2 = await client.query('DELETE FROM moves WHERE user_id = $1 RETURNING id', [id]);
      console.log(`  ✅ Deleted ${moves2.rowCount} moves`);
    }
    
    const userDelete = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    console.log(`\n✅ Deleted ${userDelete.rowCount} user`);
    
    console.log('\n🔄 ROLLING BACK (test mode)...');
    await client.query('ROLLBACK');
    
    console.log('\n✅ Delete logic works correctly! (no actual data was deleted)');
    
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during test:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

testDelete();
