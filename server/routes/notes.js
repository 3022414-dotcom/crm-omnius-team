const express = require('express');
const { requireRole } = require('../middleware/auth');
const { createNote, updateNote, deleteNote } = require('../controllers/notesController');

const router = express.Router();

router.post('/', requireRole(['admin', 'bdm']), createNote);
router.put('/:id', requireRole(['admin', 'bdm']), updateNote);
router.delete('/:id', requireRole(['admin', 'bdm']), deleteNote);

module.exports = router;
