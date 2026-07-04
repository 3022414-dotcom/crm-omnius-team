const express = require('express');
const { requireRole } = require('../middleware/auth');
const { createAccount, listAccounts, getAccountById, updateAccount, deleteAccount } = require('../controllers/accountsController');

const router = express.Router();

router.get('/', listAccounts);
router.get('/:id', getAccountById);
router.post('/', requireRole(['admin', 'bdm']), createAccount);
router.put('/:id', requireRole(['admin', 'bdm']), updateAccount);
router.delete('/:id', requireRole(['admin']), deleteAccount);

module.exports = router;
