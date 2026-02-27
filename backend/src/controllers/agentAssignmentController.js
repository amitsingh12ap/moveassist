const db = require('../../config/db');

/**
 * Auto-Assignment Algorithm for Agents
 * 
 * Logic:
 * 1. Find agents in target city
 * 2. Check availability (current workload)
 * 3. Calculate proximity score
 * 4. Sort by composite score
 * 5. Assign to best match
 * 6. Notify agent immediately
 */

// ─────────────────────────────────────────────────────────────
// Calculate distance between two points (Haversine formula)
// ─────────────────────────────────────────────────────────────
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999; // Return high value if coords missing
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// ─────────────────────────────────────────────────────────────
// Get agent's current workload (active moves)
// ─────────────────────────────────────────────────────────────
async function getAgentWorkload(agentId) {
  const result = await db.query(
    `SELECT COUNT(*) as active_moves 
     FROM moves 
     WHERE agent_id = $1 
     AND status IN ('active', 'in_progress', 'packing', 'in_transit')`,
    [agentId]
  );
  return parseInt(result.rows[0]?.active_moves || 0);
}

// ─────────────────────────────────────────────────────────────
// Calculate composite score for agent selection
// ─────────────────────────────────────────────────────────────
function calculateAgentScore(agent, move) {
  const distance = calculateDistance(
    move.from_lat, 
    move.from_lng, 
    agent.last_known_lat, 
    agent.last_known_lng
  );
  
  // Scoring weights
  const distanceWeight = 0.5;   // 50% weight to proximity
  const workloadWeight = 0.3;   // 30% weight to availability
  const ratingWeight = 0.2;     // 20% weight to performance
  
  // Normalize scores (0-100)
  const distanceScore = Math.max(0, 100 - (distance * 2)); // Closer = higher score
  const workloadScore = Math.max(0, 100 - (agent.workload * 20)); // Less work = higher score
  const ratingScore = (agent.rating || 4.5) * 20; // Convert 5-star to 100-point scale
  
  const compositeScore = 
    (distanceScore * distanceWeight) +
    (workloadScore * workloadWeight) +
    (ratingScore * ratingWeight);
  
  return {
    score: compositeScore,
    distance: distance.toFixed(2),
    workload: agent.workload,
    rating: agent.rating || 4.5
  };
}

// ─────────────────────────────────────────────────────────────
// Main Auto-Assignment Function
// ─────────────────────────────────────────────────────────────
exports.autoAssignAgent = async (moveId) => {
  try {
    // Get move details
    const moveResult = await db.query(
      `SELECT m.*, u.phone as customer_phone, u.email as customer_email, u.name as customer_name
       FROM moves m 
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1`,
      [moveId]
    );
    
    const move = moveResult.rows[0];
    if (!move) {
      throw new Error('Move not found');
    }
    
    // If agent already assigned, skip
    if (move.agent_id) {
      console.log(`Move ${moveId} already has agent assigned`);
      return { success: true, agent_id: move.agent_id, reason: 'already_assigned' };
    }
    
    // Extract city from address (basic implementation)
    const targetCity = move.to_city || move.from_city;
    
    if (!targetCity) {
      console.log('No city information available for auto-assignment');
      return { success: false, reason: 'no_city_data' };
    }
    
    // Get all available agents
    const agentsResult = await db.query(
      `SELECT 
        u.id, 
        u.name, 
        u.phone, 
        u.email,
        up.city,
        up.last_known_lat,
        up.last_known_lng,
        up.is_available,
        COALESCE(up.rating, 4.5) as rating
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.role = 'agent' 
       AND (up.is_available IS NULL OR up.is_available = true)
       ORDER BY u.created_at DESC`
    );
    
    let agents = agentsResult.rows;
    
    if (agents.length === 0) {
      console.log('No agents available in the system');
      return { success: false, reason: 'no_agents_available' };
    }
    
    // Filter agents in target city (if city data available)
    const cityAgents = agents.filter(a => {
      if (!a.city) return true; // Include agents without city set
      const normalize = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
      return normalize(a.city) === normalize(targetCity);
    });
    
    // If no agents in city, fall back to all agents
    const eligibleAgents = cityAgents.length > 0 ? cityAgents : agents;
    
    console.log(`Found ${eligibleAgents.length} eligible agents for move in ${targetCity}`);
    
    // Get workload for each agent
    for (let agent of eligibleAgents) {
      agent.workload = await getAgentWorkload(agent.id);
    }
    
    // Calculate scores and sort
    const scoredAgents = eligibleAgents.map(agent => ({
      ...agent,
      scoreData: calculateAgentScore(agent, move)
    }));
    
    scoredAgents.sort((a, b) => b.scoreData.score - a.scoreData.score);
    
    // Select best agent
    const selectedAgent = scoredAgents[0];
    
    if (!selectedAgent) {
      return { success: false, reason: 'no_suitable_agent' };
    }
    
    // Assign agent to move
    await db.query(
      `UPDATE moves 
       SET agent_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [selectedAgent.id, moveId]
    );
    
    // Send notification to agent
    await db.query(
      `INSERT INTO notifications (user_id, move_id, type, title, body)
       VALUES ($1, $2, 'move_assigned', '📋 New Move Assigned', $3)`,
      [
        selectedAgent.id,
        moveId,
        `New move: "${move.title}"
Location: ${move.from_address} → ${move.to_address}
Customer: ${move.customer_name} (${move.customer_phone})
Please visit the site and submit your quote.`
      ]
    );
    
    // Send notification to customer
    await db.query(
      `INSERT INTO notifications (user_id, move_id, type, title, body)
       VALUES ($1, $2, 'agent_assigned', '👨‍🔧 Agent Assigned to Your Move', $3)`,
      [
        move.user_id,
        moveId,
        `Agent ${selectedAgent.name} has been assigned to your move.
Phone: ${selectedAgent.phone}
They will contact you shortly to schedule a site visit and provide a final quote.`
      ]
    );
    
    // Log activity
    await db.query(
      `INSERT INTO activities (move_id, user_id, user_role, event_type, event_title, event_body, metadata)
       VALUES ($1, $2, 'system', 'agent_auto_assigned', 'Agent Auto-Assigned', $3, $4)`,
      [
        moveId,
        selectedAgent.id,
        `Agent ${selectedAgent.name} auto-assigned based on proximity and availability`,
        JSON.stringify({
          score: selectedAgent.scoreData.score,
          distance: selectedAgent.scoreData.distance,
          workload: selectedAgent.scoreData.workload,
          rating: selectedAgent.scoreData.rating,
          total_candidates: eligibleAgents.length
        })
      ]
    );
    
    console.log(`✅ Auto-assigned agent ${selectedAgent.name} (${selectedAgent.id}) to move ${moveId}`);
    console.log(`   Score: ${selectedAgent.scoreData.score.toFixed(2)}, Distance: ${selectedAgent.scoreData.distance}km, Workload: ${selectedAgent.scoreData.workload}`);
    
    return {
      success: true,
      agent_id: selectedAgent.id,
      agent_name: selectedAgent.name,
      agent_phone: selectedAgent.phone,
      score: selectedAgent.scoreData.score,
      distance: selectedAgent.scoreData.distance,
      workload: selectedAgent.scoreData.workload,
      total_candidates: eligibleAgents.length
    };
    
  } catch (error) {
    console.error('Error in autoAssignAgent:', error);
    return { success: false, reason: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
// Manually trigger auto-assignment (for existing moves)
// ─────────────────────────────────────────────────────────────
exports.triggerAutoAssignment = async (req, res) => {
  const { moveId } = req.params;
  
  try {
    const result = await exports.autoAssignAgent(moveId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Agent ${result.agent_name} assigned successfully`,
        ...result
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Auto-assignment failed',
        reason: result.reason
      });
    }
  } catch (error) {
    console.error('triggerAutoAssignment error:', error);
    res.status(500).json({ error: 'Failed to auto-assign agent' });
  }
};
