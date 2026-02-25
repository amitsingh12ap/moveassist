const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl = require('../controllers/agentQuoteController');

// Step 4a: Agent submits total amount needed from customer
router.post('/move/:moveId', auth, roleGuard(['agent','admin']), ctrl.submitQuote);
// Step 4b: Agent marks token OR full payment received (no admin verification needed)
router.post('/move/:moveId/mark-payment', auth, roleGuard(['agent','admin']), ctrl.markPaymentReceived);
// Read quote (any authenticated role)
router.get('/move/:moveId', auth, ctrl.getQuote);

module.exports = router;
