const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentGate = require('../middleware/paymentGate');
const furnitureController = require('../controllers/furnitureController');
const upload = require('../middleware/upload');

router.use(auth);

router.get('/move/:moveId', furnitureController.getByMove);
router.post('/move/:moveId', paymentGate, furnitureController.create);
router.post('/:id/photos', paymentGate, furnitureController.addPhotoBase64);
router.put('/:id/condition-after', paymentGate, furnitureController.updateConditionAfter);
router.delete('/:id', paymentGate, furnitureController.remove);

module.exports = router;
