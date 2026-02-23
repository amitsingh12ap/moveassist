const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/pricingController');
router.use(auth);
router.post('/estimate', c.estimate);
router.post('/save', c.save);
module.exports = router;
