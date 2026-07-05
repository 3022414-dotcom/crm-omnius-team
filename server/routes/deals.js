const express = require('express');
const { requireRole } = require('../middleware/auth');
const { createDeal, listDeals, getDealById, updateDeal, linkContact, unlinkContact, deleteDeal } = require('../controllers/dealsController');

const router = express.Router();

router.get('/', listDeals);
router.get('/:id', getDealById);
router.post('/', requireRole(['admin', 'bdm']), createDeal);
router.put('/:id', requireRole(['admin', 'bdm']), updateDeal);
router.post('/:id/contacts', requireRole(['admin', 'bdm']), linkContact);
router.delete('/:id/contacts/:contact_id', requireRole(['admin', 'bdm']), unlinkContact);
router.delete('/:id', requireRole(['admin']), deleteDeal);

module.exports = router;
