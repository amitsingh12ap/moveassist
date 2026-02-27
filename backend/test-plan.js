const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://amits4@localhost:5432/moveassist'
});

async function testPlanInsert() {
  try {
    // Get a real move from database
    const movesResult = await pool.query('SELECT id, agent_id FROM moves LIMIT 1');
    if (movesResult.rows.length === 0) {
      console.log('❌ No moves found in database');
      await pool.end();
      return;
    }
    
    const move = movesResult.rows[0];
    const moveId = move.id;
    const agentId = move.agent_id;
    
    console.log('Testing with move:', moveId);
    console.log('Agent:', agentId);
    
    // Build packing materials JSON
    const packingMaterials = [
      { item: 'Boxes', qty: 10 },
      { item: 'Bubble Wrap (m)', qty: 5 }
    ];
    
    // Try insert
    const result = await pool.query(
      `INSERT INTO move_plans (move_id,agent_id,package_type,vehicle_type,vehicle_number,
         movers_count,team_lead_name,team_lead_phone,packing_materials,
         packing_start_at,pickup_at,pickup_slot,estimated_delivery,
         special_instructions,internal_notes,published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [moveId, agentId, 'standard', 'tempo', 'MH01AB1234',
       3, 'Test Lead', '9876543210', JSON.stringify(packingMaterials),
       null, null, 'morning', null,
       'Test instructions', 'Test internal notes', false]
    );
    
    console.log('✅ Insert successful!', result.rows[0].id);
    
    // Clean up
    await pool.query('DELETE FROM move_plans WHERE id = $1', [result.rows[0].id]);
    console.log('✅ Cleanup done');
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Detail:', err.detail);
    console.error('Hint:', err.hint);
    console.error('Code:', err.code);
    await pool.end();
    process.exit(1);
  }
}

testPlanInsert();
