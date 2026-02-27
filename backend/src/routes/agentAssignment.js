const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const agentAssignmentController = require('../controllers/agentAssignmentController');

// Manually trigger auto-assignment for a move (admin only)
router.post('/move/:moveId/auto-assign', 
  auth, 
  roleGuard(['admin']), 
  agentAssignmentController.triggerAutoAssignment
);

module.exports = router;
