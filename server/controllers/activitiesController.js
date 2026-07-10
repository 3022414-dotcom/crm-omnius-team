const pool = require('../db/pool');

const VALID_TYPES = ['call', 'email', 'meeting', 'task'];
const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES = { account: 'accounts', contact: 'contacts', deal: 'deals' };

async function createActivity(req, res) {
  const { type, entity_type, entity_id, description, due_date } = req.body;

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'type обязателен: call/email/meeting/task' });
  }
  if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'entity_type обязателен: account/contact/deal' });
  }
  if (!entity_id) {
    return res.status(400).json({ error: 'Bad Request', message: 'entity_id обязателен' });
  }

  const { rows: entityRows } = await pool.query(
    `SELECT id FROM ${ENTITY_TABLES[entity_type]} WHERE id = $1`,
    [entity_id]
  );
  if (!entityRows[0]) {
    return res.status(404).json({ error: 'Not Found' });
  }

  const { rows: [act] } = await pool.query(
    `INSERT INTO activities (type, entity_type, entity_id, description, due_date, completed, owner_id)
     VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING *`,
    [type, entity_type, entity_id, description || null, due_date || null, req.user.id]
  );

  const overdue = act.due_date !== null && new Date(act.due_date) < new Date() && !act.completed;

  return res.status(201).json({
    id: act.id,
    type: act.type,
    entity_type: act.entity_type,
    entity_id: act.entity_id,
    description: act.description,
    due_date: act.due_date,
    completed: act.completed,
    overdue,
    owner: { id: req.user.id, name: req.user.name },
    created_at: act.created_at,
    updated_at: act.updated_at,
  });
}

function listActivitiesForEntity(entityType) {
  return async function (req, res) {
    const entityId = req.params.id;

    const { rows: entityRows } = await pool.query(
      `SELECT id FROM ${ENTITY_TABLES[entityType]} WHERE id = $1`,
      [entityId]
    );
    if (!entityRows[0]) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const { completed, type, due_date_from, due_date_to } = req.query;

    const conditions = ['a.entity_type = $1', 'a.entity_id = $2'];
    const params = [entityType, entityId];
    let idx = 3;

    if (completed !== undefined) {
      conditions.push(`a.completed = $${idx++}`);
      params.push(completed === 'true');
    }
    if (type) {
      conditions.push(`a.type = $${idx++}`);
      params.push(type);
    }
    if (due_date_from) {
      conditions.push(`(a.due_date IS NULL OR a.due_date >= $${idx++})`);
      params.push(due_date_from);
    }
    if (due_date_to) {
      conditions.push(`(a.due_date IS NULL OR a.due_date <= $${idx++})`);
      params.push(due_date_to);
    }

    const { rows } = await pool.query(
      `SELECT a.id, a.type, a.entity_type, a.entity_id, a.description, a.due_date, a.completed,
              CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() AND a.completed = false
                   THEN true ELSE false END AS overdue,
              u.id AS owner_uid, u.name AS owner_name,
              a.created_at, a.updated_at
       FROM activities a
       JOIN users u ON a.owner_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC`,
      params
    );

    return res.json(rows.map(r => ({
      id: r.id,
      type: r.type,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      description: r.description,
      due_date: r.due_date,
      completed: r.completed,
      overdue: r.overdue,
      owner: { id: r.owner_uid, name: r.owner_name },
      created_at: r.created_at,
      updated_at: r.updated_at,
    })));
  };
}

async function updateActivity(req, res) {
  const { rows: [existing] } = await pool.query(
    'SELECT id FROM activities WHERE id = $1',
    [req.params.id]
  );
  if (!existing) {
    return res.status(404).json({ error: 'Not Found' });
  }

  const { type, description, due_date, completed } = req.body;

  if (type !== undefined && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Невалидный type: call/email/meeting/task' });
  }

  const sets = [];
  const params = [];
  let idx = 1;

  if (type !== undefined)        { sets.push(`type = $${idx++}`);        params.push(type); }
  if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description); }
  if (due_date !== undefined)    { sets.push(`due_date = $${idx++}`);    params.push(due_date); }
  if (completed !== undefined)   { sets.push(`completed = $${idx++}`);   params.push(completed); }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Нет полей для обновления' });
  }

  params.push(req.params.id);
  await pool.query(
    `UPDATE activities SET ${sets.join(', ')} WHERE id = $${idx}`,
    params
  );

  const { rows: [act] } = await pool.query(
    `SELECT a.id, a.type, a.entity_type, a.entity_id, a.description, a.due_date, a.completed,
            CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() AND a.completed = false
                 THEN true ELSE false END AS overdue,
            u.id AS owner_uid, u.name AS owner_name,
            a.created_at, a.updated_at
     FROM activities a
     JOIN users u ON a.owner_id = u.id
     WHERE a.id = $1`,
    [req.params.id]
  );

  return res.json({
    id: act.id,
    type: act.type,
    entity_type: act.entity_type,
    entity_id: act.entity_id,
    description: act.description,
    due_date: act.due_date,
    completed: act.completed,
    overdue: act.overdue,
    owner: { id: act.owner_uid, name: act.owner_name },
    created_at: act.created_at,
    updated_at: act.updated_at,
  });
}

async function listActivities(req, res) {
  const { completed, type } = req.query;
  const isAdmin = req.user.role === 'admin';

  const conditions = [];
  const params = [];
  let idx = 1;

  if (!isAdmin) {
    conditions.push(`a.owner_id = $${idx++}`);
    params.push(req.user.id);
  }
  if (completed !== undefined) {
    conditions.push(`a.completed = $${idx++}`);
    params.push(completed === 'true');
  }
  if (type) {
    conditions.push(`a.type = $${idx++}`);
    params.push(type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT a.id, a.type, a.entity_type, a.entity_id, a.description, a.due_date, a.completed,
            CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() AND a.completed = false
                 THEN true ELSE false END AS overdue,
            u.id AS owner_uid, u.name AS owner_name,
            a.created_at, a.updated_at
     FROM activities a
     JOIN users u ON a.owner_id = u.id
     ${where}
     ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC`,
    params
  );

  return res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    description: r.description,
    due_date: r.due_date,
    completed: r.completed,
    overdue: r.overdue,
    owner: { id: r.owner_uid, name: r.owner_name },
    created_at: r.created_at,
    updated_at: r.updated_at,
  })));
}

async function deleteActivity(req, res) {
  const { rows: [existing] } = await pool.query(
    'SELECT id FROM activities WHERE id = $1',
    [req.params.id]
  );
  if (!existing) {
    return res.status(404).json({ error: 'Not Found' });
  }

  await pool.query('DELETE FROM activities WHERE id = $1', [req.params.id]);
  return res.status(204).send();
}

module.exports = { createActivity, listActivities, listActivitiesForEntity, updateActivity, deleteActivity };
