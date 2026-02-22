const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentGate = require('../middleware/paymentGate');
const reportsController = require('../controllers/reportsController');

router.use(auth);

router.post('/generate/:moveId', paymentGate, reportsController.generate);  // GATED — full payment required
router.get('/download/:moveId', paymentGate, reportsController.download);

module.exports = router;
