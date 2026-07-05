const express = require('express');
const { requireRole } = require('../middleware/auth');
const { createDeal, listDeals, getDealById, updateDeal, linkContact, unlinkContact, deleteDeal, getKanbanDeals, updateDealStage } = require('../controllers/dealsController');
const { listNotesForEntity } = require('../controllers/notesController');
const { listAttachmentsForEntity } = require('../controllers/attachmentsController');
const { listActivitiesForEntity } = require('../controllers/activitiesController');

const router = express.Router();

router.get('/', listDeals);
router.get('/kanban', getKanbanDeals);
router.get('/:id/notes', listNotesForEntity('deal'));
router.get('/:id/attachments', listAttachmentsForEntity('deal'));
router.get('/:id/activities', listActivitiesForEntity('deal'));
router.get('/:id', getDealById);
router.post('/', requireRole(['admin', 'bdm']), createDeal);
router.put('/:id', requireRole(['admin', 'bdm']), updateDeal);
router.patch('/:id/stage', requireRole(['admin', 'bdm']), updateDealStage);
router.post('/:id/contacts', requireRole(['admin', 'bdm']), linkContact);
router.delete('/:id/contacts/:contact_id', requireRole(['admin', 'bdm']), unlinkContact);
router.delete('/:id', requireRole(['admin']), deleteDeal);

module.exports = router;
