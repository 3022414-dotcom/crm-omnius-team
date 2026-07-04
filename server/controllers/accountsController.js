const pool = require('../db/pool');

const ACCOUNT_FIELDS = 'id, name, industry, website, phone, address, notes, owner_id, created_at, updated_at';

const ACCOUNT_WITH_COUNTS = `
  a.id, a.name, a.industry, a.website, a.phone, a.address, a.notes,
  a.owner_id, a.created_at, a.updated_at,
  (SELECT COUNT(*)::int FROM contacts WHERE account_id = a.id) AS "contactsCount",
  (SELECT COUNT(*)::int FROM deals WHERE account_id = a.id) AS "dealsCount"
`;

const UPDATABLE_FIELDS = ['name', 'industry', 'website', 'phone', 'address', 'notes'];

async function createAccount(req, res) {
  const { name, industry, website, phone, address, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Поле name обязательно' });
  }
  const { rows } = await pool.query(
    `INSERT INTO accounts (name, industry, website, phone, address, notes, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${ACCOUNT_FIELDS}`,
    [name.trim(), industry || null, website || null, phone || null, address || null, notes || null, req.user.id]
  );
  res.status(201).json(rows[0]);
}

async function listAccounts(req, res) {
  let page = parseInt(req.query.page) || 1;
  if (page < 1) page = 1;
  let limit = parseInt(req.query.limit) || 20;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = 1;
  const search = (req.query.search || '').trim();
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_WITH_COUNTS}
     FROM accounts a
     WHERE ($1 = '' OR a.name ILIKE '%' || $1 || '%')
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [search, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM accounts
     WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')`,
    [search]
  );

  res.json({ data: rows, total: countRows[0].total, page, limit });
}

async function getAccountById(req, res) {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_WITH_COUNTS}
     FROM accounts a
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  res.json(rows[0]);
}

async function updateAccount(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  if ('name' in body && (!body.name || !body.name.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Поле name не может быть пустым' });
  }

  const updates = [];
  const values = [];
  let idx = 1;
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      updates.push(`${field} = $${idx++}`);
      values.push(field === 'name' ? body[field].trim() : body[field]);
    }
  }

  if (updates.length === 0) {
    const { rows } = await pool.query(
      `SELECT ${ACCOUNT_FIELDS} FROM accounts WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    return res.json(rows[0]);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING ${ACCOUNT_FIELDS}`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  res.json(rows[0]);
}

async function deleteAccount(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT id FROM accounts WHERE id = $1', [id]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Not Found' });
    }

    // Удалить полиморфные объекты сделок аккаунта
    await client.query(
      `DELETE FROM activities WHERE entity_type = 'deal'
       AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)`,
      [id]
    );
    await client.query(
      `DELETE FROM attachments WHERE entity_type = 'deal'
       AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)`,
      [id]
    );
    await client.query(
      `DELETE FROM notes WHERE entity_type = 'deal'
       AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)`,
      [id]
    );

    // Удалить полиморфные объекты самого аккаунта
    await client.query(`DELETE FROM activities WHERE entity_type = 'account' AND entity_id = $1`, [id]);
    await client.query(`DELETE FROM attachments WHERE entity_type = 'account' AND entity_id = $1`, [id]);
    await client.query(`DELETE FROM notes WHERE entity_type = 'account' AND entity_id = $1`, [id]);

    // Удалить сделки (DB сам обнулит contacts.account_id через FK SET NULL)
    await client.query('DELETE FROM deals WHERE account_id = $1', [id]);
    await client.query('DELETE FROM accounts WHERE id = $1', [id]);

    await client.query('COMMIT');
    client.release();
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }
}

module.exports = { createAccount, listAccounts, getAccountById, updateAccount, deleteAccount };
