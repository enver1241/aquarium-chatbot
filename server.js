// server.js — AquaLifeAI (clean, Node 20)
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

// DB (only better-sqlite3)
const BetterSqlite3 = require('better-sqlite3');

// Sessions (only better-sqlite3 store)
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);

// OpenAI v4
const OpenAI = require('openai');

// ==== ENV ====
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');
const SESSIONS_DB = process.env.SESSIONS_DB || path.join(__dirname, 'sessions.sqlite');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ==== APP ====
const app = express();
app.set('trust proxy', 1);

// Security + parsers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '1mb' }));

// CORS (gerekli originleri ekle)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://aquarium-chatbot.onrender.com',
    'https://aqualifeai.com',
  ],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Rate limit (API için)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Basit istek logu
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==== STATIC ====
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get(['/', '/index.html'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==== HELPERS ====
function ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
}

// ==== DB INIT (better-sqlite3) ====
ensureFile(DB_PATH);
const db = new BetterSqlite3(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ==== SESSION STORE (better-sqlite3) ====
ensureFile(SESSIONS_DB);
const sessionDb = new BetterSqlite3(SESSIONS_DB);

app.use(session({
  name: 'sid',
  store: new BetterSqlite3Store({
    client: sessionDb,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 }, // 15 dk
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    secure: false,                 // Render + HTTPS'te true yap
    maxAge: 24 * 60 * 60 * 1000,   // 1 gün
  },
}));

function isAuthed(req) {
  return !!(req.session && req.session.user);
}

// ==== HEALTH/DIAG ====
app.get('/health', (_req, res) => res.type('text/plain').send('ok'));

app.get('/diag', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    env: process.env.RENDER ? 'render' : (process.env.NODE_ENV || 'dev'),
    hasKey: !!OPENAI_API_KEY,
    keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 7) : null,
  });
});

// ==== AUTH ====
// Register (body: {username, password})
app.post('/api/register', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const u = String(username).trim();
  if (!u || !password) return res.status(400).json({ error: 'Username & password required' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const info = stmt.run(u, hash);
    req.session.user = { id: info.lastInsertRowid, username: u };
    return res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'User exists' });
    }
    console.error('Register error:', e);
    return res.status(500).json({ error: 'Register failed' });
  }
});

// Login (body: {username, password})
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
    return res.json({ ok: true, user: { id: row.id, username: row.username } });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

// Me
app.get('/api/me', (req, res) => {
  if (!isAuthed(req)) return res.json({ user: null });
  res.json({ user: req.session.user });
});

// ==== FEEDBACK ====
// body: {name, email, message}
app.post('/api/feedback', (req, res) => {
  const { name = '', email = '', message = '' } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });
  try {
    const stmt = db.prepare('INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)');
    const info = stmt.run(name, email, message);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    console.error('Feedback error:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// ==== OPENAI CHAT ====
// body: {message}
app.post('/api/chat', async (req, res) => {
  try {
    const { message = '' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const system = 'You are AquaLifeAI, a helpful aquarium assistant. Keep answers concise, safe, and accurate for hobbyists.';

    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    const reply = r.choices?.[0]?.message?.content?.trim() || 'No reply';
    res.json({ reply });
  } catch (e) {
    console.error('OpenAI error:', e?.status, e?.message);
    res.status(e?.status || 502).json({ error: 'Connection error' });
  }
});

// ==== 404 + ERROR HANDLERS ====
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal error' });
});
// ---- Legacy aliases (frontend /register, /login, /chat kullanan sürümler için) ----

// /register  -> /api/register
app.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  // email ile gelen eski formları da destekle
  req.body = { username: username || email || '', password: password || '' };
  return app._router.handle(
    Object.assign(req, { url: '/api/register', originalUrl: '/api/register' }),
    res
  );
});

// /login  -> /api/login
app.post('/login', (req, res) => {
  const { username, email, password } = req.body || {};
  req.body = { username: username || email || '', password: password || '' };
  return app._router.handle(
    Object.assign(req, { url: '/api/login', originalUrl: '/api/login' }),
    res
  );
});

// /chat  -> /api/chat
app.post('/chat', (req, res) => {
  return app._router.handle(
    Object.assign(req, { url: '/api/chat', originalUrl: '/api/chat' }),
    res
  );
});


// ==== START ====
const server = app.listen(PORT, () => {
  console.log(`AquaLifeAI running on http://localhost:${PORT}`);
});

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
