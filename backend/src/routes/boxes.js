const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentGate = require('../middleware/paymentGate');
const boxesController = require('../controllers/boxesController');

router.use(auth);

router.get('/move/:moveId', boxesController.getByMove);                        // view allowed always
router.post('/move/:moveId', paymentGate, boxesController.create);             // GATED — create box
router.post('/scan/:qrCode', paymentGate, boxesController.scan);               // GATED — scan
router.get('/qr/:qrCode', boxesController.getByQR);                            // lookup always allowed
router.put('/:id/status', paymentGate, boxesController.updateStatus);          // GATED
router.delete('/:id', paymentGate, boxesController.remove);                    // GATED

module.exports = router;
