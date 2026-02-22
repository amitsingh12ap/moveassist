const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const movesController = require('../controllers/movesController');

router.use(auth);

router.get('/', movesController.getAll);
router.get('/agent/assigned', roleGuard(['agent','admin']), movesController.getAgentMoves);
router.get('/admin/all', roleGuard(['admin']), movesController.getAllAdmin);
router.post('/', movesController.create);
router.get('/:id', movesController.getOne);
router.put('/:id', movesController.update);
router.put('/:id/assign-agent', roleGuard(['admin']), movesController.assignAgent);
router.delete('/:id', movesController.remove);

module.exports = router;
