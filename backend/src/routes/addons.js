const express = require('express');
const router = express.Router();
const c = require('../controllers/addonsController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.get('/analytics', auth, roleGuard(['admin']), c.getServiceAnalytics);
router.get('/available/:moveId', auth, roleGuard(['agent','admin']), c.getAvailableServices);
router.get('/move/:moveId', auth, c.getMoveAddons);
router.post('/move', auth, roleGuard(['agent','admin']), c.addToMove);
router.delete('/move/:id', auth, roleGuard(['agent','admin']), c.removeFromMove);
router.post('/calculate', auth, c.calculatePrice);
router.post('/', auth, roleGuard(['admin']), c.createService);
router.get('/', auth, c.getAllServices);
router.get('/:id', auth, c.getServiceById);
router.put('/:id', auth, roleGuard(['admin']), c.updateService);
router.delete('/:id', auth, roleGuard(['admin']), c.deleteService);

module.exports = router;
