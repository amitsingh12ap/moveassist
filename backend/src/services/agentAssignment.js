const db = require('../../config/db');

/**
 * Auto-assign agent to a move based on:
 * 1. Same city as destination
 * 2. Agent availability (not overloaded)
 * 3. Proximity to move location
 * 4. Performance rating
 */
async function autoAssignAgent(moveId, fromCity, toCity, toLat, toLng) {
  try {
    // Prioritize destination city for agent assignment
    const targetCity = toCity || fromCity;
    
    if (!targetCity) {
      console.log(`No city info for move ${moveId}, cannot auto-assign`);
      return null;
    }

    console.log(`Auto-assigning agent for move ${moveId} in city: ${targetCity}`);

    // Get all available agents
    // TODO: Add agent location, availability, max_moves fields to users table
    const agentsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        COUNT(DISTINCT m.id) FILTER (WHERE m.status IN ('active', 'in_progress')) as active_moves
      FROM users u
      LEFT JOIN moves m ON m.agent_id = u.id
      WHERE u.role = 'agent'
      GROUP BY u.id, u.name, u.email, u.phone
      HAVING COUNT(DISTINCT m.id) FILTER (WHERE m.status IN ('active', 'in_progress')) < 10
      ORDER BY active_moves ASC
      LIMIT 20
    `;

    const result = await db.query(agentsQuery);
    
    if (result.rows.length === 0) {
      console.log('No available agents found');
      return null;
    }

    // For now, assign to agent with least active moves
    // TODO: Add proximity scoring when agent locations are available
    const selectedAgent = result.rows[0];
    
    console.log(`Selected agent: ${selectedAgent.name} (${selectedAgent.active_moves} active moves)`);

    // Assign agent to move
    await db.query(
      'UPDATE moves SET agent_id = $1, updated_at = NOW() WHERE id = $2',
      [selectedAgent.id, moveId]
    );

    // Notify agent
    await db.query(
      `INSERT INTO notifications (user_id, move_id, type, title, body)
       VALUES ($1, $2, 'move_assigned', '📋 New Move Assigned', $3)`,
      [selectedAgent.id, moveId, 
       `You have been assigned to a new move in ${targetCity}. Please visit the customer and submit your quote.`]
    );

    console.log(`Agent ${selectedAgent.name} assigned to move ${moveId}`);
    
    return {
      agent_id: selectedAgent.id,
      agent_name: selectedAgent.name,
      agent_phone: selectedAgent.phone,
      agent_email: selectedAgent.email
    };
  } catch (error) {
    console.error('Error in autoAssignAgent:', error);
    return null;
  }
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Score an agent for a move
 * Higher score = better fit
 */
function scoreAgent(agent, move) {
  let score = 100;
  
  // Deduct points for active workload
  score -= agent.active_moves * 5;
  
  // Add points for proximity (if location data available)
  if (agent.lat && agent.lng && move.to_lat && move.to_lng) {
    const distance = calculateDistance(
      agent.lat, agent.lng,
      move.to_lat, move.to_lng
    );
    // Closer is better (max 20 points for < 5km, 0 points for > 50km)
    score += Math.max(0, 20 - (distance / 2.5));
  }
  
  // Add points for performance rating (if available)
  if (agent.rating) {
    score += agent.rating * 2; // Max 10 points for 5-star rating
  }
  
  return score;
}

module.exports = {
  autoAssignAgent,
  calculateDistance,
  scoreAgent
};
