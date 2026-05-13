const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const RP_ID   = process.env.RP_ID   || 'localhost';
const RP_NAME = process.env.RP_NAME || 'Money Matriz';
const ORIGIN  = process.env.ORIGIN  || 'http://localhost:5173';

// Short-lived in-memory challenge store (5 min TTL)
const regChallenges  = new Map(); // user_id → { challenge, expires }
const authChallenges = new Map(); // challenge → { expires }

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
function fromb64url(str) { return Buffer.from(str, 'base64url'); }

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, user_type: user.user_type, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, user_type: user.user_type, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.user_type, u.role, u.phone, u.scheme, u.is_active, u.created_at,
             sh.name as manager_name, sh.email as manager_email
      FROM users u
      LEFT JOIN relationships r ON r.client_id = u.id
      LEFT JOIN users sh ON sh.id = r.shareholder_id
      WHERE u.id = $1
    `, [req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── WebAuthn / Passkey ────────────────────────────────────────────

// POST /api/auth/webauthn/register-options  (authenticated)
router.post('/webauthn/register-options', authenticate, async (req, res) => {
  try {
    const { rows: existing } = await query(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1', [req.user.id]
    );
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: String(req.user.id),
      userName: req.user.email,
      attestationType: 'none',
      excludeCredentials: existing.map(c => ({
        id: fromb64url(c.credential_id),
        type: 'public-key',
        transports: JSON.parse(c.transports || '["internal"]'),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });
    regChallenges.set(req.user.id, { challenge: options.challenge, expires: Date.now() + 5 * 60_000 });
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/webauthn/register-verify  (authenticated)
router.post('/webauthn/register-verify', authenticate, async (req, res) => {
  try {
    const stored = regChallenges.get(req.user.id);
    if (!stored || Date.now() > stored.expires) {
      return res.status(400).json({ error: 'Challenge expired — try again.' });
    }
    regChallenges.delete(req.user.id);

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
    if (!verified || !registrationInfo) {
      return res.status(400).json({ error: 'Verification failed.' });
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = registrationInfo;
    const transports = req.body.response?.transports ?? ['internal'];

    await query(`
      INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, device_type, backed_up, transports)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (credential_id) DO UPDATE
        SET public_key = EXCLUDED.public_key, counter = EXCLUDED.counter
    `, [
      b64url(credentialID), req.user.id, b64url(credentialPublicKey),
      counter, credentialDeviceType, credentialBackedUp,
      JSON.stringify(Array.isArray(transports) ? transports : ['internal']),
    ]);

    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/webauthn/login-options  (public)
router.post('/webauthn/login-options', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    let allowCredentials = [];
    if (email) {
      const { rows: users } = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (users[0]) {
        const { rows: creds } = await query(
          'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1', [users[0].id]
        );
        allowCredentials = creds.map(c => ({
          id: fromb64url(c.credential_id),
          type: 'public-key',
          transports: JSON.parse(c.transports || '["internal"]'),
        }));
      }
    }
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials,
    });
    authChallenges.set(options.challenge, { expires: Date.now() + 5 * 60_000 });
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/webauthn/login-verify  (public)
router.post('/webauthn/login-verify', async (req, res) => {
  try {
    let challenge;
    try {
      const clientData = JSON.parse(fromb64url(req.body.response.clientDataJSON).toString());
      challenge = clientData.challenge;
    } catch {
      return res.status(400).json({ error: 'Malformed response.' });
    }

    const stored = authChallenges.get(challenge);
    if (!stored || Date.now() > stored.expires) {
      return res.status(400).json({ error: 'Challenge expired — try again.' });
    }
    authChallenges.delete(challenge);

    const { rows: credRows } = await query(
      'SELECT * FROM webauthn_credentials WHERE credential_id = $1', [req.body.id]
    );
    const cred = credRows[0];
    if (!cred) return res.status(401).json({ error: 'Unknown credential.' });

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: fromb64url(cred.credential_id),
        credentialPublicKey: fromb64url(cred.public_key),
        counter: parseInt(cred.counter),
        transports: JSON.parse(cred.transports || '["internal"]'),
      },
    });
    if (!verified) return res.status(401).json({ error: 'Authentication failed.' });

    await query('UPDATE webauthn_credentials SET counter = $1 WHERE credential_id = $2',
      [authenticationInfo.newCounter, req.body.id]);

    const { rows: userRows } = await query(
      'SELECT id, name, email, user_type, role FROM users WHERE id = $1 AND is_active = true', [cred.user_id]
    );
    const user = userRows[0];
    if (!user) return res.status(403).json({ error: 'Account deactivated.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, user_type: user.user_type, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, user_type: user.user_type, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
