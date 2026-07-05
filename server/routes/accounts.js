const express = require('express');
const { requireRole } = require('../middleware/auth');
const { createAccount, listAccounts, getAccountById, updateAccount, deleteAccount } = require('../controllers/accountsController');
const { listContactsByAccount } = require('../controllers/contactsController');
const { listNotesForEntity } = require('../controllers/notesController');
const { listAttachmentsForEntity } = require('../controllers/attachmentsController');
const { listActivitiesForEntity } = require('../controllers/activitiesController');

const router = express.Router();

router.get('/', listAccounts);
router.get('/:id/contacts', listContactsByAccount);
router.get('/:id/notes', listNotesForEntity('account'));
router.get('/:id/attachments', listAttachmentsForEntity('account'));
router.get('/:id/activities', listActivitiesForEntity('account'));
router.get('/:id', getAccountById);
router.post('/', requireRole(['admin', 'bdm']), createAccount);
router.put('/:id', requireRole(['admin', 'bdm']), updateAccount);
router.delete('/:id', requireRole(['admin']), deleteAccount);

module.exports = router;
