const pool = require('../db/pool');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');

const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES = { account: 'accounts', contact: 'contacts', deal: 'deals' };
const ENTITY_DIRS   = { account: 'accounts', contact: 'contacts', deal: 'deals' };

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const entityType = req.body.entity_type;
    const entityId   = req.body.entity_id;
    const dir = (ENTITY_DIRS[entityType] && entityId)
      ? path.join(__dirname, '../../uploads', ENTITY_DIRS[entityType], entityId)
      : path.join(__dirname, '../../uploads', 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, `${randomUUID()}_${file.originalname}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

async function createAttachment(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Bad Request', message: 'Файл обязателен' });
  }
  const entity_type = req.body.entity_type;
  const entity_id   = req.body.entity_id;

  if (!VALID_ENTITY_TYPES.includes(entity_type)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Bad Request', message: 'Невалидный entity_type' });
  }
  if (!entity_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Bad Request', message: 'entity_id обязателен' });
  }

  const table = ENTITY_TABLES[entity_type];
  const { rows: entityRows } = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [entity_id]);
  if (!entityRows[0]) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Not Found' });
  }

  const relPath = path.relative(path.join(__dirname, '../../'), req.file.path);

  const { rows: [att] } = await pool.query(
    `INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [entity_type, entity_id, req.file.originalname, relPath, req.file.size, req.file.mimetype, req.user.id]
  );

  return res.status(201).json({
    id: att.id,
    file_name: att.file_name,
    file_size: att.file_size,
    mime_type: att.mime_type,
    entity_type: att.entity_type,
    entity_id: att.entity_id,
    uploaded_by: { id: req.user.id, name: req.user.name },
    created_at: att.created_at,
    url: '/' + relPath,
  });
}

function listAttachmentsForEntity(entityType) {
  return async function(req, res) {
    const entityId = req.params.id;
    const table = ENTITY_TABLES[entityType];
    const { rows: entityRows } = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [entityId]);
    if (!entityRows[0]) return res.status(404).json({ error: 'Not Found' });

    const { rows } = await pool.query(
      `SELECT a.id, a.file_name, a.file_size, a.mime_type, a.entity_type, a.entity_id, a.created_at,
              u.id AS uploader_id, u.name AS uploader_name
       FROM attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.entity_type = $1 AND a.entity_id = $2
       ORDER BY a.created_at DESC`,
      [entityType, entityId]
    );

    return res.json(rows.map(r => ({
      id: r.id,
      file_name: r.file_name,
      file_size: r.file_size,
      mime_type: r.mime_type,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      uploaded_by: { id: r.uploader_id, name: r.uploader_name },
      created_at: r.created_at,
    })));
  };
}

async function downloadAttachment(req, res) {
  const { id } = req.params;
  const { rows: [att] } = await pool.query('SELECT * FROM attachments WHERE id = $1', [id]);
  if (!att) return res.status(404).json({ error: 'Not Found' });

  const filePath = path.join(__dirname, '../../', att.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not Found' });

  res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
  res.download(filePath, att.file_name, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  });
}

async function deleteAttachment(req, res) {
  const { id } = req.params;
  const { rows: [att] } = await pool.query('SELECT * FROM attachments WHERE id = $1', [id]);
  if (!att) return res.status(404).json({ error: 'Not Found' });

  await pool.query('DELETE FROM attachments WHERE id = $1', [id]);

  const filePath = path.join(__dirname, '../../', att.file_path);
  try { fs.unlinkSync(filePath); } catch (e) {}

  return res.status(204).send();
}

module.exports = { upload, createAttachment, listAttachmentsForEntity, downloadAttachment, deleteAttachment };
