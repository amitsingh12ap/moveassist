const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl = require('../controllers/paymentsController');
const tokenCtrl = require('../controllers/tokenPaymentController');
const quoteCtrl = require('../controllers/agentQuoteController');

// ── Existing ─────────────────────────────────────────────────
router.get('/move/:moveId', auth, ctrl.getSummary);
router.post('/move/:moveId/initiate', auth, ctrl.initiate);
router.post('/move/:moveId/online', auth, ctrl.payOnline);
router.post('/move/:moveId/cash', auth, roleGuard(['agent','admin']), ctrl.markCashReceived);
router.post('/:paymentId/verify', auth, roleGuard(['admin']), ctrl.verifyPayment);
router.get('/invoice/:moveId', auth, ctrl.getInvoice);

// ── Step 1: Admin sets confirmed price ────────────────────────
router.post('/move/:moveId/set-pricing', auth, roleGuard(['admin','agent']), tokenCtrl.setPricing);

// ── Step 2: Customer pays 10% token ──────────────────────────
router.post('/move/:moveId/token', auth, roleGuard(['customer']), tokenCtrl.initiateToken);

// ── Step 3: Admin verifies token → activates move ────────────
router.post('/move/:moveId/verify-token', auth, roleGuard(['admin']), tokenCtrl.verifyToken);

// ── Step 5: Customer pays remaining balance ───────────────────
router.post('/move/:moveId/pay-balance', auth, roleGuard(['customer']), tokenCtrl.payBalance);

// ── Step 6: Admin verifies balance → move in_progress ────────
router.post('/move/:moveId/verify-balance', auth, roleGuard(['admin']), tokenCtrl.verifyBalance);

module.exports = router;
