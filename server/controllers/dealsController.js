const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const UPDATABLE_FIELDS = ['title', 'value', 'close_date', 'account_id', 'stage', 'owner_id'];

async function createDeal(req, res) {
  const title = req.body.title?.trim();
  if (!title) return res.status(400).json({ error: 'Bad Request', message: 'title обязателен' });

  const account_id = req.body.account_id || null;
  if (account_id) {
    const { rows } = await pool.query('SELECT id FROM accounts WHERE id=$1', [account_id]);
    if (!rows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Аккаунт не найден' });
  }

  const { rows: [deal] } = await pool.query(
    `INSERT INTO deals (title, value, stage, close_date, account_id, owner_id)
     VALUES ($1, $2, 'lead', $3, $4, $5)
     RETURNING *`,
    [title, req.body.value || null, req.body.close_date || null, account_id, req.user.id]
  );
  return res.status(201).json(deal);
}

async function listDeals(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const stage      = req.query.stage      || null;
  const account_id = req.query.account_id || null;
  const owner_id   = req.query.owner_id   || null;
  const search     = req.query.search     || null;
  const date_from  = req.query.date_from  || null;
  const date_to    = req.query.date_to    || null;

  const whereParams = [stage, account_id, owner_id, search, date_from, date_to];
  const whereClause = `
    WHERE ($1::text IS NULL OR d.stage = $1)
      AND ($2::uuid IS NULL OR d.account_id = $2)
      AND ($3::uuid IS NULL OR d.owner_id = $3)
      AND ($4::text IS NULL OR d.title ILIKE '%' || $4 || '%')
      AND ($5::date IS NULL OR d.close_date >= $5::date)
      AND ($6::date IS NULL OR d.close_date <= $6::date)
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT d.id, d.title, d.value, d.stage, d.close_date,
              d.account_id, d.owner_id, d.created_at, d.updated_at,
              a.name AS account_name,
              u.name AS owner_name,
              (SELECT COUNT(*) FROM deal_contacts dc WHERE dc.deal_id = d.id) AS contacts_count
       FROM deals d
       LEFT JOIN accounts a ON d.account_id = a.id
       LEFT JOIN users   u ON d.owner_id   = u.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $7 OFFSET $8`,
      [...whereParams, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM deals d ${whereClause}`,
      whereParams
    ),
  ]);

  const data = dataResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    value: row.value,
    stage: row.stage,
    close_date: row.close_date,
    account_id: row.account_id,
    owner_id: row.owner_id,
    account: row.account_id ? { id: row.account_id, name: row.account_name } : null,
    owner: { id: row.owner_id, name: row.owner_name },
    contacts_count: parseInt(row.contacts_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return res.json({ data, total: parseInt(countResult.rows[0].count), page, limit });
}

async function getDealById(req, res) {
  const { id } = req.params;

  const { rows: [row] } = await pool.query(
    `SELECT d.id, d.title, d.value, d.stage, d.close_date,
            d.account_id, d.owner_id, d.created_at, d.updated_at,
            a.name AS account_name,
            u.name AS owner_name
     FROM deals d
     LEFT JOIN accounts a ON d.account_id = a.id
     LEFT JOIN users   u ON d.owner_id   = u.id
     WHERE d.id = $1`,
    [id]
  );
  if (!row) return res.status(404).json({ error: 'Not Found' });

  const { rows: contacts } = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.photo_path
     FROM contacts c
     JOIN deal_contacts dc ON c.id = dc.contact_id
     WHERE dc.deal_id = $1`,
    [id]
  );

  return res.json({
    id: row.id,
    title: row.title,
    value: row.value,
    stage: row.stage,
    close_date: row.close_date,
    account_id: row.account_id,
    owner_id: row.owner_id,
    account: row.account_id ? { id: row.account_id, name: row.account_name } : null,
    owner: { id: row.owner_id, name: row.owner_name },
    contacts,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function updateDeal(req, res) {
  const { id } = req.params;
  const body = req.body;

  if ('stage' in body && !VALID_STAGES.includes(body.stage))
    return res.status(400).json({ error: 'Bad Request', message: 'Невалидный stage' });
  if ('title' in body && !body.title?.trim())
    return res.status(400).json({ error: 'Bad Request', message: 'title не может быть пустым' });

  if ('account_id' in body && body.account_id) {
    const { rows } = await pool.query('SELECT id FROM accounts WHERE id=$1', [body.account_id]);
    if (!rows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Аккаунт не найден' });
  }
  if ('owner_id' in body && body.owner_id) {
    const { rows } = await pool.query('SELECT id FROM users WHERE id=$1', [body.owner_id]);
    if (!rows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Пользователь не найден' });
  }

  const setClauses = [];
  const values = [];
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      values.push(field === 'title' ? body[field].trim() : body[field]);
      setClauses.push(`${field} = $${values.length}`);
    }
  }

  if (setClauses.length > 0) {
    values.push(id);
    const result = await pool.query(
      `UPDATE deals SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not Found' });
  }

  const { rows: [row] } = await pool.query(
    `SELECT d.id, d.title, d.value, d.stage, d.close_date,
            d.account_id, d.owner_id, d.created_at, d.updated_at,
            a.name AS account_name,
            u.name AS owner_name
     FROM deals d
     LEFT JOIN accounts a ON d.account_id = a.id
     LEFT JOIN users   u ON d.owner_id   = u.id
     WHERE d.id = $1`,
    [id]
  );
  if (!row) return res.status(404).json({ error: 'Not Found' });

  return res.json({
    id: row.id,
    title: row.title,
    value: row.value,
    stage: row.stage,
    close_date: row.close_date,
    account_id: row.account_id,
    owner_id: row.owner_id,
    account: row.account_id ? { id: row.account_id, name: row.account_name } : null,
    owner: { id: row.owner_id, name: row.owner_name },
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function linkContact(req, res) {
  const dealId    = req.params.id;
  const contactId = req.body.contact_id;

  const { rows: deal } = await pool.query('SELECT id FROM deals WHERE id=$1', [dealId]);
  if (!deal[0]) return res.status(404).json({ error: 'Not Found' });

  const { rows: contact } = await pool.query('SELECT id FROM contacts WHERE id=$1', [contactId]);
  if (!contact[0]) return res.status(400).json({ error: 'Bad Request', message: 'Контакт не найден' });

  const { rows } = await pool.query(
    'INSERT INTO deal_contacts (deal_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING deal_id',
    [dealId, contactId]
  );
  return res.status(rows.length ? 201 : 200).json({});
}

async function unlinkContact(req, res) {
  const { id: dealId, contact_id: contactId } = req.params;

  const { rows: deal } = await pool.query('SELECT id FROM deals WHERE id=$1', [dealId]);
  if (!deal[0]) return res.status(404).json({ error: 'Not Found' });

  await pool.query('DELETE FROM deal_contacts WHERE deal_id=$1 AND contact_id=$2', [dealId, contactId]);
  return res.status(204).send();
}

async function deleteDeal(req, res) {
  const { id } = req.params;

  const { rows: deal } = await pool.query('SELECT id FROM deals WHERE id=$1', [id]);
  if (!deal[0]) return res.status(404).json({ error: 'Not Found' });

  await pool.query("DELETE FROM activities  WHERE entity_type='deal' AND entity_id=$1", [id]);
  const { rows: dealAtts } = await pool.query(
    "SELECT file_path FROM attachments WHERE entity_type='deal' AND entity_id=$1",
    [id]
  );
  for (const att of dealAtts) {
    try { fs.unlinkSync(path.join(__dirname, '../../', att.file_path)); } catch (e) {}
  }
  await pool.query("DELETE FROM attachments WHERE entity_type='deal' AND entity_id=$1", [id]);
  await pool.query("DELETE FROM notes       WHERE entity_type='deal' AND entity_id=$1", [id]);
  await pool.query('DELETE FROM deals WHERE id=$1', [id]);

  return res.status(204).send();
}

module.exports = { createDeal, listDeals, getDealById, updateDeal, linkContact, unlinkContact, deleteDeal };
