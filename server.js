// server.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const { OpenAI } = require("openai");

const app = express();

/* ------------------------ App & Middleware ------------------------ */
app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Production arkasında proxy varsa (Railway/Render/Heroku vb.)
app.set("trust proxy", 1);

// Kalıcı session (sqlite dosyasında tutulur)
app.use(
  session({
    name: "aquabot.sid",
    store: new SQLiteStore({ db: "sessions.sqlite", dir: __dirname }),
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // https'ta true olmalı
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 gün
    },
  })
);

// Statik dosyalar
const publicDir = __dirname; // index.html, style.css, script.js...
app.use(express.static(publicDir));

// Upload klasörü
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

/* ------------------------ Database ------------------------ */
const dbFile = path.join(__dirname, "db.sqlite");
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* ------------------------ Helpers ------------------------ */
function requireAuth(req, res, next) {
  if (req.session?.userId) return next();

  // HTML istekler login'e yönlendirilsin
  if (req.accepts("html")) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/Chatbot.html");
    return res.redirect(`/login.html?next=${nextUrl}`);
  }
  // API ise 401
  return res.status(401).json({ error: "Unauthorized" });
}

/* ------------------------ Auth & User ------------------------ */

// Me (navbar için)
app.get("/auth/me", (req, res) => {
  if (!req.session?.userId) return res.json({ loggedIn: false });
  db.get(
    "SELECT id, email, display_name, avatar_url FROM users WHERE id = ?",
    [req.session.userId],
    (err, row) => {
      if (err || !row) return res.json({ loggedIn: false });
      res.json({ loggedIn: true, user: row });
    }
  );
});

// Register
app.post("/register", async (req, res) => {
  try {
    const { email, password, display_name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const hash = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users(email, password_hash, display_name) VALUES (?,?,?)",
      [email.toLowerCase(), hash, display_name || email.split("@")[0]],
      function (err) {
        if (err) {
          if (String(err).includes("UNIQUE")) {
            return res.status(409).json({ error: "Email already registered" });
          }
          return res.status(500).json({ error: "DB error" });
        }
        req.session.userId = this.lastID;
        res.json({ ok: true });
      }
    );
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }
  db.get(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email.toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      req.session.userId = row.id;
      res.json({ ok: true });
    }
  );
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("aquabot.sid");
    res.json({ ok: true });
  });
});

/* ------------------------ Profile ------------------------ */

// Profil görüntüle (korumalı)
app.get("/profile", requireAuth, (req, res) => {
  db.get(
    "SELECT id, email, display_name, avatar_url FROM users WHERE id = ?",
    [req.session.userId],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    }
  );
});

// Profil güncelle (şimdilik display_name)
app.put("/profile", requireAuth, (req, res) => {
  const { display_name } = req.body || {};
  db.run(
    "UPDATE users SET display_name = ? WHERE id = ?",
    [display_name, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ ok: true });
    }
  );
});

// Avatar upload
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 2 }, // 2MB
  fileFilter: (_, file, cb) => {
    const ok = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    cb(ok ? null : new Error("Only PNG/JPG/WEBP images allowed"), ok);
  },
}).single("avatar");

app.post("/profile/avatar", requireAuth, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: String(err.message || err) });
    const rel = "/uploads/" + path.basename(req.file.path);
    db.run(
      "UPDATE users SET avatar_url = ? WHERE id = ?",
      [rel, req.session.userId],
      (e2) => {
        if (e2) return res.status(500).json({ error: "DB error" });
        res.json({ ok: true, avatar_url: rel });
      }
    );
  });
});

/* ------------------------ Feedback ------------------------ */

app.post("/feedback", requireAuth, (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Message required" });
  db.run(
    "INSERT INTO feedbacks(user_id, message) VALUES(?,?)",
    [req.session.userId, message],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

/* ------------------------ Chatbot (korumalı) ------------------------ */

// Chatbot sayfasını sadece girişe izin vererek sun
app.get("/Chatbot.html", requireAuth, (req, res) => {
  res.sendFile(path.join(publicDir, "Chatbot.html"));
});

// Chat API
app.post("/chat", requireAuth, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const out = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are an aquarium assistant for hobbyists. Keep answers concise and practical." },
        { role: "user", content: message },
      ],
    });

    const reply =
      out?.choices?.[0]?.message?.content?.trim() || "I couldn't generate a reply.";
    res.json({ reply });
  } catch (e) {
    console.error("Chat error:", e?.response?.data || e);
    res.status(500).json({ error: "Connection error." });
  }
});

/* ------------------------ Fallbacks ------------------------ */

// Kök / -> index.html
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// 404 için sade yanıt (SPA değil)
app.use((req, res) => {
  res.status(404).send("Not Found");
});

/* ------------------------ Start ------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AquaLifeAI server listening on http://localhost:${PORT}`);
});
