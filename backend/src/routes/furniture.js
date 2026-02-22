const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentGate = require('../middleware/paymentGate');
const furnitureController = require('../controllers/furnitureController');
const upload = require('../middleware/upload');

router.use(auth);

router.get('/move/:moveId', furnitureController.getByMove);                           // view always
router.post('/move/:moveId', paymentGate, furnitureController.create);                // GATED
router.post('/:id/photos', paymentGate, upload.array('photos', 10), furnitureController.addPhotos); // GATED
router.put('/:id/condition-after', paymentGate, furnitureController.updateConditionAfter); // GATED
router.delete('/:id', paymentGate, furnitureController.remove);                       // GATED

module.exports = router;
