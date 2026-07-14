const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Unauthenticated liveness/readiness probe for the deploy health check (FR-017).
// Mounted BEFORE the /api/v1 auth guard in app.js so the edge can reach it.
router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error' });
  }
});

module.exports = router;
