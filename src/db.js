import { Pool } from 'pg';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Cloud SQL recommended keepAlive
  keepAlive: true,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PG pool error');
});

export async function query(text, params) {
  // basic retry for transient errors
  const maxAttempts = 3;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const start = Date.now();
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug({ duration, rows: res.rowCount }, 'db.query');
      return res;
    } catch (err) {
      const retriable = isTransientPgError(err) && attempt < maxAttempts;
      logger.warn({ err, attempt }, 'db.query failed');
      if (retriable) {
        await wait(100 * attempt);
        continue;
      }
      throw err;
    }
  }
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

function isTransientPgError(err) {
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('ECONNRESET'.toLowerCase()) ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('sorry, too many clients already')
  );
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
