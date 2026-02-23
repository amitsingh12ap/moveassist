const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/ratingsController');
router.use(auth);
router.post('/move/:moveId', c.create);
router.get('/move/:moveId', c.getByMove);
module.exports = router;
