const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(auth, roleGuard(['admin']));

router.get('/stats', ctrl.getStats);
router.get('/moves', ctrl.getMoves);
router.put('/moves/:id/assign-agent', ctrl.assignAgent);
router.put('/moves/:id/status', ctrl.updateMoveStatus);
router.get('/payments/pending', ctrl.getPendingPayments);
router.post('/moves/:id/mark-paid', ctrl.markMovePaid);
router.post('/payments/:id/verify', ctrl.verifyPayment);
router.get('/users', ctrl.getUsers);
router.put('/users/:id/role', ctrl.updateUserRole);
router.post('/users/agent', ctrl.createAgent);

module.exports = router;
