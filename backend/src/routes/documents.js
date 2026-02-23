const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/documentsController');
router.use(auth);
router.get('/move/:moveId', c.getByMove);
router.post('/move/:moveId', c.upload);
router.delete('/:id', c.remove);
module.exports = router;
