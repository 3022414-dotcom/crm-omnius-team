const express = require('express');
const { requireRole } = require('../middleware/auth');
const { getMe, listUsers, getUserById, updateUserRole } = require('../controllers/usersController');

const router = express.Router();

router.get('/me', getMe);
router.get('/', listUsers);
router.get('/:id', requireRole(['admin']), getUserById);
router.patch('/:id/role', requireRole(['admin']), updateUserRole);

module.exports = router;
