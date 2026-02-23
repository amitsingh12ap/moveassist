const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/activitiesController');
router.use(auth);
router.get('/move/:moveId', c.getByMove);
router.post('/move/:moveId', c.add);
module.exports = router;
