const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '../../data/cron-status.json');

function load() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { return {}; }
}

function recordRun(name, status, error, durationMs) {
  const data = load();
  data[name] = { status, error: error || null, lastRun: new Date().toISOString(), durationMs };
  try {
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('[cronTracker] write failed:', e.message); }
}

async function tracked(name, fn) {
  const start = Date.now();
  try {
    await fn();
    recordRun(name, 'ok', null, Date.now() - start);
  } catch (err) {
    recordRun(name, 'error', err.message, Date.now() - start);
    console.error(`[cron] ${name} error:`, err.message);
  }
}

function getCronStatus() { return load(); }

module.exports = { tracked, getCronStatus };
