const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { pool, runWithActor } = require('../db');

// Never store these, at any depth, whatever route they arrive on.
const SECRET_KEYS = /^(password|password_hash|new_password|current_password|confirm_password|token|refresh_token|secret)$/i;
const MAX_BODY_CHARS = 20000;

function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function bodyForLog(body) {
  if (!body || typeof body !== 'object' || !Object.keys(body).length) return null;
  const clean = redact(body);
  const text = JSON.stringify(clean);
  if (text.length <= MAX_BODY_CHARS) return clean;
  // Bulk imports can carry hundreds of rows; keep the shape, drop the bulk.
  return { truncated: true, size: text.length, preview: text.slice(0, 2000) };
}

function actorFromRequest(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const u = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return { id: u.id, name: u.name, role: u.role };
  } catch {
    return null;
  }
}

function activityLogger(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const rid = randomUUID();
  const started = Date.now();
  const actor = actorFromRequest(req);

  // `rid` ties this request to the row changes its triggers record, so the two
  // can be shown together. Carried inside the actor because that is what reaches
  // the database session.
  const context = { rid, ...(actor || {}) };

  res.on('finish', () => {
    const row = {
      rid,
      actor,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration: Date.now() - started,
      body: bodyForLog(req.body),
      ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim() || null,
    };

    // Logging must never delay or fail the request it describes.
    pool.query(
      `INSERT INTO activity_log
         (source, request_id, actor_id, actor_name, actor_role, method, path, status_code, duration_ms, request_body, ip)
       VALUES ('http', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.rid, row.actor?.id ?? null, row.actor?.name ?? null, row.actor?.role ?? null,
       row.method, row.path, row.status, row.duration, row.body, row.ip]
    ).catch((err) => console.error('[activity] could not record request:', err.message));
  });

  runWithActor(context, () => next());
}

module.exports = { activityLogger };
