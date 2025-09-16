// server.js — AquaLifeAI (Node 20, better-sqlite3, OpenAI Responses API)
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
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
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", "data:", "https:", 'http:', 'blob:', '*'],
      connectSrc: ["'self'", 'https://api.openai.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
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

// Ensure uploads directory exists with proper permissions
const uploadsDir = path.join(__dirname, 'uploads');
// Ensure uploads directory exists with proper permissions
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
  console.log('Created uploads directory at:', uploadsDir);
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
  console.log('Created uploads directory at:', uploadsDir);
}

// Static files with proper caching and CORS
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  }
}));

// Serve uploads with proper CORS and caching
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Serve static files from root for backward compatibility
app.use(express.static(__dirname, { extensions: ['html'] }));

// Index route
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

// Test file upload endpoint moved after upload middleware
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Test file upload endpoint
app.post('/api/test-upload', upload.single('testfile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('Test file uploaded:', req.file);
    res.json({
      ok: true,
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
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

// Handle avatar upload with cache busting
app.post('/api/profile/avatar', isAuthed, upload.single('avatar'), async (req, res) => {
  // Add cache busting
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  console.log('Avatar upload request received');
  console.log('Session user:', req.session.user);
  
  if (!req.file) {
    console.log('No file in request');
    return res.status(400).json({ error: 'No file uploaded or invalid file type' });
  }

  console.log('File uploaded successfully:', req.file);

  try {
    const userId = req.session.user.id;
    
    // Get the filename from the stored file (req.file.filename is set by multer)
    const filename = req.file.filename;
    const avatarUrl = '/uploads/' + filename;
    
    // Ensure the file is properly moved to the final location
    const tempPath = req.file.path;
    const targetPath = path.join(uploadsDir, filename);
    
    // If the file is already in the right place, no need to move it
    if (tempPath !== targetPath) {
      fs.renameSync(tempPath, targetPath);
    }
    
    console.log('Updating user profile with avatar:', { userId, avatarUrl });
    
    // First, get the old avatar URL to delete it later
    const oldAvatar = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
    
    // Update user's avatar in database
    const stmt = db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
    const result = stmt.run(avatarUrl, userId);
    
    console.log('Database update result:', result);
    
    if (result.changes === 0) {
      throw new Error('User not found or no changes made');
    }
    
    // Delete old avatar file if it exists and is not the default
    if (oldAvatar && oldAvatar.avatar_url && !oldAvatar.avatar_url.includes('default-avatar')) {
      const oldAvatarPath = path.join(__dirname, 'public', oldAvatar.avatar_url);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlink(oldAvatarPath, (err) => {
          if (err) console.error('Error deleting old avatar:', err);
          else console.log('Old avatar deleted:', oldAvatarPath);
        });
      }
    }
    
    // Update session
    req.session.user.avatar_url = avatarUrl;
    
    console.log('Avatar update successful, sending response');
    
    res.json({ 
      ok: true, 
      avatar_url: avatarUrl 
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    // Clean up the uploaded file if there was an error
    if (req.file && req.file.path) {
      console.log('Cleaning up uploaded file:', req.file.path);
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error cleaning up file:', unlinkErr);
      });
    }
    res.status(500).json({ error: 'Failed to update avatar', details: error.message });
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
