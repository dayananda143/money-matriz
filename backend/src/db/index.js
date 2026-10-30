const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Who is behind the request currently being served. Held per-request rather than
// passed through every call, so routes need no changes to be audited.
const actorStore = new AsyncLocalStorage();
const getActor = () => actorStore.getStore() || null;
const runWithActor = (actor, fn) => actorStore.run(actor, fn);

const IS_WRITE = /^\s*(insert|update|delete)\b/i;

// Attaches the actor to the current transaction so the audit triggers can read it.
// SET LOCAL only lasts for the transaction, which keeps it from leaking to the
// next request that borrows the same pooled connection.
async function applyActor(client) {
  const actor = getActor();
  if (!actor) return false;
  await client.query(`SELECT set_config('app.actor', $1, true)`, [JSON.stringify(actor)]);
  return true;
}

async function query(text, params) {
  const actor = getActor();

  // Reads, and writes with nobody attached, go straight to the pool. A write made
  // while serving a request is wrapped in a transaction purely so the actor can be
  // set alongside it — without that the triggers would log the change as having
  // come from outside the app.
  if (!actor || typeof text !== 'string' || !IS_WRITE.test(text)) {
    return pool.query(text, params);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyActor(client);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, pool, actorStore, getActor, runWithActor, applyActor };
