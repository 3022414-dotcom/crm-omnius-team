const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  createContact,
  listContacts,
  getContactById,
  updateContact,
  uploadContactPhoto,
  deleteContactPhoto,
  deleteContact,
} = require('../controllers/contactsController');

const router = express.Router();

router.get('/', listContacts);
router.get('/:id', getContactById);

router.post('/', requireRole(['admin', 'bdm']), createContact);
router.put('/:id', requireRole(['admin', 'bdm']), updateContact);

router.post('/:id/photo', requireRole(['admin', 'bdm']), (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Payload Too Large', message: 'Файл не должен превышать 5 MB' });
      }
      if (err.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: 'Bad Request', message: 'Допустимые форматы: jpeg, jpg, png, webp' });
      }
      return next(err);
    }
    uploadContactPhoto(req, res, next);
  });
});

router.delete('/:id/photo', requireRole(['admin', 'bdm']), deleteContactPhoto);
router.delete('/:id', requireRole(['admin']), deleteContact);

module.exports = router;
