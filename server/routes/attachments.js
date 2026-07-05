const express = require('express');
const { requireRole } = require('../middleware/auth');
const {
  upload,
  createAttachment,
  downloadAttachment,
  deleteAttachment,
} = require('../controllers/attachmentsController');

const router = express.Router();

router.post('/', requireRole(['admin', 'bdm']), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Payload Too Large', message: 'Файл не должен превышать 50 MB' });
    }
    if (err) return next(err);
    createAttachment(req, res, next);
  });
});

router.get('/:id/download', downloadAttachment);
router.delete('/:id', requireRole(['admin']), deleteAttachment);

module.exports = router;
