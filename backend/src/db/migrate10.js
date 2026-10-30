const { query } = require('./index');

// Tables whose every row change is recorded. Reference and noise tables
// (notifications, news, cron state) are deliberately left out.
const AUDITED = [
  'transactions', 'holdings', 'stocks', 'stock_groups', 'brokerage_transactions',
  'users', 'balances', 'stock_alerts', 'sip_plans', 'sip_installments',
  'trade_requests', 'relationships', 'fund_movements',
];

async function migrate() {
  // One table holds both halves of the story:
  //   source 'http' — one row per write request: who, what endpoint, outcome
  //   source 'row'  — one row per actual row change, with before/after
  // They share request_id, so a request and the changes it caused read together.
  // A row change with no actor came from outside the app (psql, a script) and is
  // recorded as source 'database' — the whole point of auditing at this level.
  await query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id            BIGSERIAL PRIMARY KEY,
      source        VARCHAR(10) NOT NULL CHECK (source IN ('http', 'row', 'database')),
      request_id    UUID,

      actor_id      INTEGER,
      actor_name    VARCHAR(255),
      actor_role    VARCHAR(20),

      method        VARCHAR(10),
      path          TEXT,
      status_code   INTEGER,
      duration_ms   INTEGER,
      request_body  JSONB,

      table_name    VARCHAR(63),
      record_id     BIGINT,
      op            VARCHAR(10),
      before_row    JSONB,
      after_row     JSONB,
      changed_fields TEXT[],

      ip            VARCHAR(64),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log (created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON activity_log (actor_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS activity_log_record_idx ON activity_log (table_name, record_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS activity_log_request_idx ON activity_log (request_id)`);

  // Reads the actor the app stashed for this transaction. Absent means the write
  // did not come through the app, which is recorded rather than hidden.
  await query(`
    CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger AS $audit$
    DECLARE
      actor      jsonb;
      changed    text[];
      new_j      jsonb;
      old_j      jsonb;
    BEGIN
      BEGIN
        actor := nullif(current_setting('app.actor', true), '')::jsonb;
      EXCEPTION WHEN others THEN
        actor := NULL;
      END;

      new_j := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
      old_j := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;

      IF TG_OP = 'UPDATE' THEN
        SELECT array_agg(k) INTO changed
        FROM jsonb_object_keys(new_j) AS k
        WHERE new_j -> k IS DISTINCT FROM old_j -> k;
        -- A write that changed nothing is not worth a log line.
        IF changed IS NULL THEN RETURN NEW; END IF;
      END IF;

      INSERT INTO activity_log (
        source, request_id, actor_id, actor_name, actor_role,
        table_name, record_id, op, before_row, after_row, changed_fields
      ) VALUES (
        CASE WHEN actor IS NULL THEN 'database' ELSE 'row' END,
        CASE WHEN actor ? 'rid' THEN (actor->>'rid')::uuid ELSE NULL END,
        (actor->>'id')::integer, actor->>'name', actor->>'role',
        TG_TABLE_NAME,
        COALESCE((new_j->>'id')::bigint, (old_j->>'id')::bigint),
        lower(TG_OP), old_j, new_j, changed
      );

      RETURN COALESCE(NEW, OLD);
    END;
    $audit$ LANGUAGE plpgsql
  `);

  for (const table of AUDITED) {
    const { rows } = await query(`SELECT to_regclass($1) AS t`, [table]);
    if (!rows[0].t) { console.log(`migrate10: skipping ${table} (not present)`); continue; }
    await query(`DROP TRIGGER IF EXISTS audit_${table} ON ${table}`);
    await query(`
      CREATE TRIGGER audit_${table}
      AFTER INSERT OR UPDATE OR DELETE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION audit_row_change()
    `);
  }

  console.log(`migrate10: activity_log ready, auditing ${AUDITED.length} tables`);
}

migrate().catch(e => { console.error(e); process.exit(1); });
