require('dotenv').config();
const pool = require('./pool');

const users = [
  { name: 'Дмитрий Твердохлебов', email: 'dima@omnius.team',              role: 'admin'  },
  { name: 'Юлия Шевцова',          email: 'shevtsova_julia@omnius.team',   role: 'admin'  },
  { name: 'Анастасия Стефанова',   email: 'anastasia@omnius.team',         role: 'bdm'    },
  { name: 'Илья Болховский',       email: 'ilya.bolkhovsky@gmail.com',     role: 'viewer' },
];

async function seed() {
  const client = await pool.connect();
  try {
    for (const u of users) {
      await client.query(
        `INSERT INTO users (name, email, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, u.role]
      );
    }
    const { rows } = await client.query('SELECT name, role FROM users ORDER BY name');
    console.log(`Seeded ${rows.length} users:`);
    rows.forEach(r => console.log(`  ${r.role.padEnd(7)} ${r.name}`));
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
