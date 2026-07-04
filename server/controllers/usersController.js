const pool = require('../db/pool');

const USER_FIELDS = 'id, name, email, role, created_at';
const VALID_ROLES = ['admin', 'bdm', 'viewer'];

async function getMe(req, res) {
  const { id, name, email, role, created_at } = req.user;
  res.json({ id, name, email, role, created_at });
}

async function listUsers(req, res) {
  const { rows } = await pool.query(
    `SELECT ${USER_FIELDS} FROM users ORDER BY name`
  );
  res.json(rows);
}

async function getUserById(req, res) {
  const { rows } = await pool.query(
    `SELECT ${USER_FIELDS} FROM users WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  res.json(rows[0]);
}

async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Недопустимое значение роли. Допустимые значения: admin, bdm, viewer',
    });
  }

  if (req.user.id === id) {
    return res.status(403).json({ error: 'Forbidden', message: 'Нельзя изменить собственную роль' });
  }

  const target = await pool.query(`SELECT ${USER_FIELDS}, role AS current_role FROM users WHERE id = $1`, [id]);
  if (!target.rows[0]) return res.status(404).json({ error: 'Not Found' });

  if (target.rows[0].current_role === 'admin') {
    const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin'`);
    if (countRows[0].cnt === 1) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Невозможно изменить роль единственного администратора',
      });
    }
  }

  const { rows } = await pool.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING ${USER_FIELDS}`,
    [role, id]
  );
  res.json(rows[0]);
}

module.exports = { getMe, listUsers, getUserById, updateUserRole };
