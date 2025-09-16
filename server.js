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

const PORT = Number(process.env.PORT) || 10000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');
const SESSIONS_DB = process.env.SESSIONS_DB || path.join(__dirname, 'sessions.sqlite');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const app = express();
app.set('trust proxy', 1);

// Security + parsers
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
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

// Explicit route for thanks.html to ensure it's served properly
app.get('/thanks.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'thanks.html'));
});

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
    display_name TEXT,
    avatar_url TEXT,
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

// --- Profile
app.get('/api/profile', (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not authenticated' });
  const user = req.session.user;
  res.json({
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_url || '/uploads/default-avatar.svg'
  });
});

app.put('/api/profile', (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not authenticated' });
  const { display_name = '' } = req.body || {};
  const userId = req.session.user.id;
  
  try {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, userId);
    req.session.user.display_name = display_name;
    res.json({ ok: true });
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// --- Admin routes
app.get('/admin/feedback', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (e) {
    console.error('Admin feedback fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// --- Feedback
app.post('/api/feedback', (req, res) => {
  console.log('Feedback endpoint called with:', req.body);
  
  const { name = '', email = '', message = '' } = req.body || {};
  
  // Validate required fields
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    console.log('Validation failed - missing fields');
    return res.status(400).json({ 
      ok: false, 
      error: 'All fields (name, email, message) are required' 
    });
  }
  
  try {
    // Save to database
    console.log('Saving to database...');
    const info = db.prepare('INSERT INTO feedback(name,email,message) VALUES(?,?,?)').run(
      name.trim(), 
      email.trim(), 
      message.trim()
    );
    console.log('Database save successful, ID:', info.lastInsertRowid);
    
    // Save to text file
    const feedbackDir = path.join(__dirname, 'feedback_files');
    console.log('Feedback directory:', feedbackDir);
    
    // Create feedback directory if it doesn't exist
    if (!fs.existsSync(feedbackDir)) {
      console.log('Creating feedback directory...');
      fs.mkdirSync(feedbackDir, { recursive: true });
    }
    
    // Create filename with timestamp and ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `feedback_${info.lastInsertRowid}_${timestamp}.txt`;
    const filepath = path.join(feedbackDir, filename);
    console.log('Creating file:', filepath);
    
    // Format feedback content
    const feedbackContent = `FEEDBACK #${info.lastInsertRowid}
Date: ${new Date().toLocaleString()}
Name: ${name.trim()}
Email: ${email.trim()}
Message:
${message.trim()}

---
Saved to database with ID: ${info.lastInsertRowid}
Timestamp: ${new Date().toISOString()}
`;
    
    // Write to file
    fs.writeFileSync(filepath, feedbackContent, 'utf8');
    console.log('File saved successfully:', filename);
    
    // Verify file was created
    if (fs.existsSync(filepath)) {
      console.log('File verification successful');
    } else {
      console.error('File verification failed - file does not exist');
    }
    
    console.log(`✅ Feedback saved successfully: Database ID ${info.lastInsertRowid}, File: ${filename}`);
    
    res.json({ 
      ok: true, 
      id: info.lastInsertRowid,
      message: 'Thank you for your feedback! Your message has been saved and we will review it soon.',
      filename: filename
    });
  } catch (e) {
    console.error('❌ Feedback save error:', e);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to save feedback. Please try again.' 
    });
  }
});

// --- OpenAI chat
app.post('/api/chat', async (req, res) => {
  const { message = '' } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message required' });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  try {
    // Clean and validate API key
    const cleanApiKey = OPENAI_API_KEY ? OPENAI_API_KEY.trim().replace(/\s+/g, '') : '';
    
    if (!cleanApiKey || cleanApiKey === '' || cleanApiKey === 'sk-proj-your-openai-api-key-here') {
      throw new Error('OpenAI API key not properly configured');
    }

    // Validate API key format
    if (!cleanApiKey.startsWith('sk-') || cleanApiKey.length < 20) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Check for invalid characters that would cause HTTP header issues
    if (!/^[a-zA-Z0-9\-_]+$/.test(cleanApiKey)) {
      throw new Error('OpenAI API key contains invalid characters');
    }

    const client = new OpenAI({ 
      apiKey: cleanApiKey,
      timeout: 60000,
      maxRetries: 3,
      dangerouslyAllowBrowser: false
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are AquaLifeAI, a helpful aquarium assistant. Keep answers concise and safe.' },
        { role: 'user', content: message }
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'No reply';
    res.json({ reply });
  } catch (e) {
    console.error('OpenAI error details:');
    console.error('- Status:', e?.status);
    console.error('- Code:', e?.code);
    console.error('- Message:', e?.message);
    console.error('- Type:', e?.type);
    console.error('- Name:', e?.name);
    console.error('- Full error:', e);
    if (e?.response?.data) console.error('- Response data:', JSON.stringify(e.response.data, null, 2));
    
    // More robust error handling
    if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === '') {
      res.status(500).json({ error: 'OpenAI API key not configured' });
    } else if (e?.message?.includes('invalid characters') || e?.message?.includes('not a legal HTTP header value')) {
      res.status(500).json({ error: 'Invalid API key format. Please check your OpenAI API key in environment variables.' });
    } else if (e?.message?.includes('Invalid OpenAI API key format')) {
      res.status(500).json({ error: 'Invalid API key format. Please verify your OpenAI API key.' });
    } else if (e?.code === 'ECONNRESET' || e?.code === 'ETIMEDOUT' || e?.name === 'ConnectTimeoutError' || e?.code === 'ENOTFOUND') {
      res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    } else if (e?.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
    } else if (e?.status === 401 || e?.status === 403) {
      res.status(500).json({ error: 'API authentication failed' });
    } else if (e?.message?.includes('fetch')) {
      res.status(503).json({ error: 'Network connection failed. Please try again.' });
    } else {
      res.status(502).json({ error: 'AI service unavailable' });
    }
  }
});

// --- Legacy aliaslar (eski HTML'ler için): /register, /login, /chat, /feedback
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
app.post('/feedback', (req, res) => {
  return app._router.handle(Object.assign(req, { url: '/api/feedback', originalUrl: '/api/feedback' }), res);
});
app.get('/profile', (req, res) => {
  return app._router.handle(Object.assign(req, { url: '/api/profile', originalUrl: '/api/profile' }), res);
});
app.put('/profile', (req, res) => {
  return app._router.handle(Object.assign(req, { url: '/api/profile', originalUrl: '/api/profile' }), res);
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
