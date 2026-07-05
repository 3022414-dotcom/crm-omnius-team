const pool = require('../db/pool');

const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES = { account: 'accounts', contact: 'contacts', deal: 'deals' };

async function createNote(req, res) {
  const entity_type = req.body.entity_type;
  const entity_id = req.body.entity_id;
  const content = (req.body.content || '').trim();

  if (!VALID_ENTITY_TYPES.includes(entity_type))
    return res.status(400).json({ error: 'Bad Request', message: 'Невалидный entity_type' });

  if (!content)
    return res.status(400).json({ error: 'Bad Request', message: 'content обязателен' });

  const table = ENTITY_TABLES[entity_type];
  const { rows: entityRows } = await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [entity_id]);
  if (!entityRows[0]) return res.status(404).json({ error: 'Not Found' });

  const { rows: [note] } = await pool.query(
    `INSERT INTO notes (entity_type, entity_id, content, author_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [entity_type, entity_id, content, req.user.id]
  );

  return res.status(201).json({
    id: note.id,
    content: note.content,
    entity_type: note.entity_type,
    entity_id: note.entity_id,
    author: { id: req.user.id, name: req.user.name },
    created_at: note.created_at,
    updated_at: note.updated_at,
  });
}

function listNotesForEntity(entityType) {
  return async function(req, res) {
    const entityId = req.params.id;
    const table = ENTITY_TABLES[entityType];

    const { rows: entityRows } = await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [entityId]);
    if (!entityRows[0]) return res.status(404).json({ error: 'Not Found' });

    const { rows } = await pool.query(
      `SELECT n.id, n.content, n.entity_type, n.entity_id,
              n.author_id, n.created_at, n.updated_at,
              u.name AS author_name
       FROM notes n
       JOIN users u ON n.author_id = u.id
       WHERE n.entity_type = $1 AND n.entity_id = $2
       ORDER BY n.created_at DESC`,
      [entityType, entityId]
    );

    return res.json(rows.map(r => ({
      id: r.id,
      content: r.content,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      author: { id: r.author_id, name: r.author_name },
      created_at: r.created_at,
      updated_at: r.updated_at,
    })));
  };
}

async function updateNote(req, res) {
  const { id } = req.params;
  const content = (req.body.content || '').trim();

  if (!content)
    return res.status(400).json({ error: 'Bad Request', message: 'content обязателен' });

  const { rows: [note] } = await pool.query('SELECT * FROM notes WHERE id=$1', [id]);
  if (!note) return res.status(404).json({ error: 'Not Found' });

  if (note.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  const { rows: [updated] } = await pool.query(
    `UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [content, id]
  );

  const { rows: [author] } = await pool.query('SELECT name FROM users WHERE id=$1', [updated.author_id]);

  return res.json({
    id: updated.id,
    content: updated.content,
    entity_type: updated.entity_type,
    entity_id: updated.entity_id,
    author: { id: updated.author_id, name: author.name },
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  });
}

async function deleteNote(req, res) {
  const { id } = req.params;

  const { rows: [note] } = await pool.query('SELECT * FROM notes WHERE id=$1', [id]);
  if (!note) return res.status(404).json({ error: 'Not Found' });

  if (note.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  await pool.query('DELETE FROM notes WHERE id=$1', [id]);
  return res.status(204).send();
}

module.exports = { createNote, listNotesForEntity, updateNote, deleteNote };
