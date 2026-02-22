const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl = require('../controllers/paymentsController');

router.get('/move/:moveId', auth, ctrl.getSummary);
router.post('/move/:moveId/initiate', auth, ctrl.initiate);
router.post('/move/:moveId/online', auth, ctrl.payOnline);
router.post('/move/:moveId/cash', auth, roleGuard(['agent','admin']), ctrl.markCashReceived); // agents only
router.post('/:paymentId/verify', auth, roleGuard(['admin']), ctrl.verifyPayment);            // admin only
router.get('/invoice/:moveId', auth, ctrl.getInvoice);

module.exports = router;
