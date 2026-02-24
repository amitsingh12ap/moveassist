const express = require('express');
const router  = express.Router();
const auth     = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl     = require('../controllers/movePlanController');

// Agent saves/updates move plan (draft or confirmed)
router.post('/move/:moveId',  auth, roleGuard(['agent','admin']), ctrl.savePlan);
// Anyone on the move can read the plan
router.get('/move/:moveId',   auth, ctrl.getPlan);

module.exports = router;
