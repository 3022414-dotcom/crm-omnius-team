const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');

const CONTACT_FIELDS = 'id, first_name, last_name, email, email_corp, email_personal, phone, position, photo_path, telegram, linkedin, facebook, location, language, preferred_communication, birthday, comments, source, account_id, owner_id, created_at, updated_at';
const UPDATABLE_FIELDS = ['first_name', 'last_name', 'email', 'email_corp', 'email_personal', 'phone', 'position', 'account_id', 'telegram', 'linkedin', 'facebook', 'location', 'language', 'preferred_communication', 'birthday', 'comments', 'source'];

async function savePhoto(contactId, file) {
  const rawExt = file.mimetype.split('/')[1];
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const uuid = randomUUID();
  const dir = path.join(__dirname, '..', '..', 'uploads', 'contacts', contactId);
  const filename = `avatar_${uuid}.${ext}`;
  const filepath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(filepath, file.buffer);
  return path.join('uploads', 'contacts', contactId, filename);
}

async function createContact(req, res) {
  const { first_name, last_name, email, email_corp, email_personal, phone, position, account_id,
          telegram, linkedin, facebook, location, language, preferred_communication, birthday, comments, source } = req.body;

  if (!first_name || !first_name.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Поле first_name обязательно' });
  }
  if (!last_name || !last_name.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Поле last_name обязательно' });
  }

  if (account_id) {
    const { rows: accRows } = await pool.query('SELECT id FROM accounts WHERE id = $1', [account_id]);
    if (!accRows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Аккаунт не найден' });
  }

  const { rows } = await pool.query(
    `INSERT INTO contacts (first_name, last_name, email, email_corp, email_personal, phone, position, account_id,
                           telegram, linkedin, facebook, location, language, preferred_communication, birthday, comments, source, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING ${CONTACT_FIELDS}`,
    [first_name.trim(), last_name.trim(), email || null, email_corp || null, email_personal || null,
     phone || null, position || null, account_id || null,
     telegram || null, linkedin || null, facebook || null,
     location || null, language || null, preferred_communication || null,
     birthday || null, comments || null, source || null, req.user.id]
  );
  res.status(201).json(rows[0]);
}

async function listContacts(req, res) {
  let page = parseInt(req.query.page) || 1;
  if (page < 1) page = 1;
  let limit = parseInt(req.query.limit) || 20;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = 1;
  const search = (req.query.search || '').trim();
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.email, c.email_corp, c.phone, c.position, c.photo_path,
            c.account_id, c.owner_id, c.created_at, c.updated_at,
            a.name AS account_name
     FROM contacts c
     LEFT JOIN accounts a ON c.account_id = a.id
     WHERE ($1 = '' OR (
       c.first_name ILIKE '%' || $1 || '%' OR
       c.last_name  ILIKE '%' || $1 || '%' OR
       c.email      ILIKE '%' || $1 || '%' OR
       c.email_corp ILIKE '%' || $1 || '%'
     ))
     ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
    [search, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM contacts
     WHERE ($1 = '' OR (
       first_name ILIKE '%' || $1 || '%' OR
       last_name  ILIKE '%' || $1 || '%' OR
       email      ILIKE '%' || $1 || '%'
     ))`,
    [search]
  );
  res.json({ data: rows, total: countRows[0].total, page, limit });
}

async function getContactById(req, res) {
  const { rows } = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.email, c.email_corp, c.email_personal,
            c.phone, c.position, c.photo_path,
            c.telegram, c.linkedin, c.facebook,
            c.location, c.language, c.preferred_communication,
            c.birthday, c.comments, c.source,
            c.account_id, c.owner_id, c.created_at, c.updated_at,
            a.name AS account_name
     FROM contacts c
     LEFT JOIN accounts a ON c.account_id = a.id
     WHERE c.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  res.json(rows[0]);
}

async function listContactsByAccount(req, res) {
  const { id } = req.params;

  const { rows: accRows } = await pool.query('SELECT id FROM accounts WHERE id = $1', [id]);
  if (!accRows[0]) return res.status(404).json({ error: 'Not Found' });

  let page = parseInt(req.query.page) || 1;
  if (page < 1) page = 1;
  let limit = parseInt(req.query.limit) || 20;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = 1;
  const search = (req.query.search || '').trim();
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ${CONTACT_FIELDS} FROM contacts
     WHERE account_id = $1
       AND ($2 = '' OR (
         first_name ILIKE '%' || $2 || '%' OR
         last_name  ILIKE '%' || $2 || '%' OR
         email      ILIKE '%' || $2 || '%'
       ))
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [id, search, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM contacts
     WHERE account_id = $1
       AND ($2 = '' OR (
         first_name ILIKE '%' || $2 || '%' OR
         last_name  ILIKE '%' || $2 || '%' OR
         email      ILIKE '%' || $2 || '%'
       ))`,
    [id, search]
  );
  res.json({ data: rows, total: countRows[0].total, page, limit });
}

async function updateContact(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  if ('first_name' in body && (!body.first_name || !body.first_name.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Поле first_name не может быть пустым' });
  }
  if ('last_name' in body && (!body.last_name || !body.last_name.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Поле last_name не может быть пустым' });
  }

  if ('account_id' in body && body.account_id) {
    const { rows: accRows } = await pool.query('SELECT id FROM accounts WHERE id = $1', [body.account_id]);
    if (!accRows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Аккаунт не найден' });
  }

  const updates = [];
  const values = [];
  let idx = 1;
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      updates.push(`${field} = $${idx++}`);
      if (field === 'first_name' || field === 'last_name') {
        values.push(body[field].trim());
      } else {
        values.push(body[field] === '' ? null : body[field]);
      }
    }
  }

  if (updates.length === 0) {
    const { rows } = await pool.query(`SELECT ${CONTACT_FIELDS} FROM contacts WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    return res.json(rows[0]);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING ${CONTACT_FIELDS}`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  res.json(rows[0]);
}

async function uploadContactPhoto(req, res) {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Bad Request', message: 'Файл не загружен' });

  const { rows } = await pool.query('SELECT photo_path FROM contacts WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });

  if (rows[0].photo_path) {
    const oldAbs = path.join(__dirname, '..', '..', rows[0].photo_path);
    await fs.promises.unlink(oldAbs).catch(() => {});
  }

  const newRelPath = await savePhoto(id, req.file);
  await pool.query(
    'UPDATE contacts SET photo_path = $1, updated_at = NOW() WHERE id = $2',
    [newRelPath, id]
  );
  res.json({ photo_url: `/${newRelPath}` });
}

async function deleteContactPhoto(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT photo_path FROM contacts WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });

  if (rows[0].photo_path) {
    const absPath = path.join(__dirname, '..', '..', rows[0].photo_path);
    await fs.promises.unlink(absPath).catch(() => {});
  }

  await pool.query('UPDATE contacts SET photo_path = NULL, updated_at = NOW() WHERE id = $1', [id]);
  res.json({});
}

async function deleteContact(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT photo_path FROM contacts WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });

  const photoPath = rows[0].photo_path;

  await pool.query(`DELETE FROM activities   WHERE entity_type = 'contact' AND entity_id = $1`, [id]);
  const { rows: contactAtts } = await pool.query(
    `SELECT file_path FROM attachments WHERE entity_type = 'contact' AND entity_id = $1`,
    [id]
  );
  for (const att of contactAtts) {
    try { fs.unlinkSync(path.join(__dirname, '../../', att.file_path)); } catch (e) {}
  }
  await pool.query(`DELETE FROM attachments  WHERE entity_type = 'contact' AND entity_id = $1`, [id]);
  await pool.query(`DELETE FROM notes        WHERE entity_type = 'contact' AND entity_id = $1`, [id]);
  await pool.query('DELETE FROM contacts WHERE id = $1', [id]);

  if (photoPath) {
    const absPath = path.join(__dirname, '..', '..', photoPath);
    await fs.promises.unlink(absPath).catch(() => {});
  }

  res.status(204).send();
}

module.exports = {
  createContact,
  listContacts,
  getContactById,
  listContactsByAccount,
  updateContact,
  uploadContactPhoto,
  deleteContactPhoto,
  deleteContact,
};
