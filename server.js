// server.js — AquaLifeAI (Node 20, better-sqlite3, OpenAI Responses API)
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const BetterSqlite3 = require('better-sqlite3');
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const OpenAI = require('openai');

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');
const SESSIONS_DB = process.env.SESSIONS_DB || path.join(__dirname, 'sessions.sqlite');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const app = express();
app.set('trust proxy', 1);

// Security + parsers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '1mb' }));

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://aquarium-chatbot.onrender.com', 'https://aqualifeai.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Rate limit (sadece /api)
const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Basit log
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Static + index
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- Helpers
function ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
}

// --- DB
ensureFile(DB_PATH);
const db = new BetterSqlite3(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS feedback(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// --- Sessions
ensureFile(SESSIONS_DB);
const sessionDb = new BetterSqlite3(SESSIONS_DB);
app.use(session({
  name: 'sid',
  store: new BetterSqlite3Store({
    client: sessionDb,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 },
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax', secure: false, maxAge: 24 * 60 * 60 * 1000 },
}));

const isAuthed = (req) => !!(req.session && req.session.user);

// --- Health & Diag
app.get('/health', (_req, res) => res.type('text/plain').send('ok'));
app.get('/diag', (_req, res) => {
  res.json({ ok: true, node: process.version, hasKey: !!OPENAI_API_KEY });
});
app.get('/probe_openai', async (_req, res) => {
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });
    const body = await r.text();
    res.json({ ok: true, status: r.status, ct: r.headers.get('content-type'), bodyStart: body.slice(0, 120) });
  } catch (e) {
    res.status(502).json({ ok: false, name: e.name, message: e.message });
  }
});

// --- AUTH
app.post('/api/register', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const u = String(username).trim();
  if (!u || !password) return res.status(400).json({ error: 'Username & password required' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)').run(u, hash);
    req.session.user = { id: info.lastInsertRowid, username: u };
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'User exists' });
    console.error('Register error:', e);
    res.status(500).json({ error: 'Register failed' });
  }
});

app.post('/api/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const u = String(username).trim();
  if (!u || !password) return res.status(400).json({ error: 'Username & password required' });

  try {
    const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username=?').get(u);
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.user = { id: row.id, username: row.username };
    res.json({ ok: true, user: { id: row.id, username: row.username } });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  res.json({ user: isAuthed(req) ? req.session.user : null });
});

// --- Feedback
app.post('/api/feedback', (req, res) => {
  const { name = '', email = '', message = '' } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });
  try {
    const info = db.prepare('INSERT INTO feedback(name,email,message) VALUES(?,?,?)').run(name, email, message);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    console.error('Feedback error:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// --- OpenAI chat (Responses API, daha stabil)
app.post('/api/chat', async (req, res) => {
  const { message = '' } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message required' });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  try {
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    const r = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: 'You are AquaLifeAI, a helpful aquarium assistant. Keep answers concise and safe.' },
        { role: 'user', content: message }
      ],
      temperature: 0.4,
      max_output_tokens: 400,
    });

    const reply =
      (r.output_text && r.output_text.trim()) ||
      (r.output?.[0]?.content?.[0]?.text?.value?.trim()) ||
      'No reply';

    res.json({ reply });
  } catch (e) {
    // Ayrıntılı log: konsola tam hata dök, istemciye kısa mesaj ver
    console.error('OpenAI error:', e?.status || e?.code, e?.message);
    if (e?.response?.data) console.error('OpenAI data:', e.response.data);
    res.status(502).json({ error: 'Connection error' });
  }
});

// --- Legacy aliaslar (eski HTML’ler için): /register, /login, /chat
app.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  req.body = { username: username || email || '', password: password || '' };
  return app._router.handle(Object.assign(req, { url: '/api/register', originalUrl: '/api/register' }), res);
});
app.post('/login', (req, res) => {
  const { username, email, password } = req.body || {};
  req.body = { username: username || email || '', password: password || '' };
  return app._router.handle(Object.assign(req, { url: '/api/login', originalUrl: '/api/login' }), res);
});
app.post('/chat', (req, res) => {
  return app._router.handle(Object.assign(req, { url: '/api/chat', originalUrl: '/api/chat' }), res);
});

// 404 & error handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal error' });
});

// START
const server = app.listen(PORT, () => console.log(`AquaLifeAI running on http://localhost:${PORT}`));

// Graceful shutdown
function shutdown(sig) {
  return () => {
    console.log(`${sig} received, shutting down...`);
    server.close(() => {
      try { db.close(); } catch {}
      process.exit(0);
    });
  };
}
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
