const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl = require('../controllers/agentQuoteController');

// Step 4: Agent submits on-site quote
router.post('/move/:moveId', auth, roleGuard(['agent','admin']), ctrl.submitQuote);
// Read quote (any authenticated role for their own move)
router.get('/move/:moveId', auth, ctrl.getQuote);

module.exports = router;
