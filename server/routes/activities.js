const express = require('express');
const { requireRole } = require('../middleware/auth');
const { createActivity, updateActivity, deleteActivity } = require('../controllers/activitiesController');

const router = express.Router();

router.post('/', requireRole(['admin', 'bdm']), createActivity);
router.put('/:id', requireRole(['admin', 'bdm']), updateActivity);
router.delete('/:id', requireRole(['admin']), deleteActivity);

module.exports = router;
