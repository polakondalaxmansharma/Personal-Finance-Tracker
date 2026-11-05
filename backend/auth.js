// Phase 6: authentication, hashed passwords and verified JWTs.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const authRouter = express.Router();

function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set JWT_SECRET to a random string of at least 32 characters in backend/.env');
  }
  return process.env.JWT_SECRET;
}
function publicUser(row) { return { userId: row.user_id, name: row.name, email: row.email }; }
function validEmail(email) { return typeof email === 'string' && email.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validPassword(password) { return typeof password === 'string' && password.length >= 10 && Buffer.byteLength(password, 'utf8') <= 72; }
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
authRouter.use(['/register', '/login'], authLimiter);

authRouter.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !validEmail(email) || !validPassword(password)) {
    return res.status(400).json({ error: 'Provide a name, valid email, and password of 10–72 UTF-8 bytes.' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name.trim(), email.trim().toLowerCase(), hash]);
    res.status(201).json({ message: 'Account created. Please log in.', userId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered.' });
    console.error('Registration failed:', error); res.status(500).json({ error: 'Unable to register right now.' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string') return res.status(401).json({ error: 'Invalid email or password.' });
  try {
    const [rows] = await db.execute('SELECT user_id, name, email, password_hash FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    const user = rows[0];
    const ok = user && await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
    const token = jwt.sign({ userId: user.user_id }, secret(), { expiresIn: '2h', algorithm: 'HS256' });
    res.json({ token, user: publicUser(user) });
  } catch (error) { console.error('Login failed:', error); res.status(500).json({ error: 'Unable to log in right now.' }); }
});

function requireAuth(req, res, next) {
  const match = /^Bearer (.+)$/i.exec(req.get('Authorization') || '');
  if (!match) return res.status(401).json({ error: 'Please log in.' });
  try {
    const decoded = jwt.verify(match[1], secret(), { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) throw new Error('Invalid user');
    req.user = { userId: decoded.userId };
    next();
  } catch (error) { res.status(401).json({ error: 'Session invalid or expired. Please log in again.' }); }
}
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT user_id, name, email FROM users WHERE user_id=? LIMIT 1', [req.user.userId]);
    if (!rows.length) return res.status(401).json({ error: 'Account no longer exists.' });
    res.json({ user: publicUser(rows[0]) });
  } catch (error) { console.error('Profile failed:', error); res.status(500).json({ error: 'Unable to fetch profile.' }); }
});
module.exports = { authRouter, requireAuth };
