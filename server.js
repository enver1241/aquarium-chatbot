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
const cors = require("cors");
const { OpenAI } = require("openai");

const app = express();

/* ---------- CORS (frontend -> backend) ---------- */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://aqualifeai.com"   // prod domainin buysa tut, değilse kendi domaininle değiştir
  ],
  credentials: false
}));

/* ---------- Parsers ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- Session (login için) ---------- */
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
      // prod https altında isen şunu açabilirsin: secure: true
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 gün
    },
  })
);

/* ---------- DB ---------- */
const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"));
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
});

/* ---------- Statik dosyalar ---------- */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(__dirname)); // index.html, css, js

/* ---------- Healthcheck ---------- */
app.get("/diag", (_, res) => {
  res.json({
    ok: true,
    env: process.env.RENDER ? "render" : "local",
    hasKey: !!process.env.OPENAI_API_KEY,
  });
});

/* ---------- Auth helper ---------- */
function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  if (req.accepts("html")) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/Chatbot.html");
    return res.redirect(`/login.html?next=${nextUrl}`);
  }
  return res.status(401).json({ error: "Unauthorized" });
}

/* ---------- Me (navbar/render icin) ---------- */
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

/* ---------- Register/Login/Logout ---------- */
app.post("/register", async (req, res) => {
  const { email, password, display_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users(email, password_hash, display_name) VALUES(?,?,?)",
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
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
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

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

/* ---------- Profil (korumalı) ---------- */
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

/* ---------- Avatar upload ---------- */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "avatar_" + Date.now() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 2 },
  fileFilter: (_, file, cb) => {
    const ok = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    cb(ok ? null : new Error("Only image files allowed"), ok);
  },
}).single("avatar");

app.post("/profile/avatar", requireAuth, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: String(err.message || err) });
    if (!req.file) return res.status(400).json({ error: "No file" });
    const rel = "/uploads/" + path.basename(req.file.path);
    db.run("UPDATE users SET avatar_url = ? WHERE id = ?", [rel, req.session.userId], (e2) => {
      if (e2) return res.status(500).json({ error: "DB error" });
      res.json({ ok: true, avatar_url: rel });
    });
  });
});

/* ---------- Korumalı sayfa (HTML) ----------- */
app.get("/Chatbot.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "Chatbot.html"));
});

/* =======================================================
   CHAT API — LOGIN ZORUNLU DEĞİL (demo’dan çıkış için)
   (İstersen header token ile koruyabilirsin)
======================================================= */

// Basit API token koruması istersen .env'ye API_TOKEN koy:
app.use("/chat", (req, res, next) => {
  const expected = process.env.API_TOKEN;
  if (!expected) return next();
  const got = req.headers["x-api-token"];
  if (got !== expected) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.json({ reply: "Server is missing OPENAI_API_KEY." });

    const client = new OpenAI({ apiKey });
    const out = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 700, // daha ayrıntılı yanıt için artırıldı
      messages: [
        { role: "system",
          content: "You are AquaLifeAI, an aquarium expert assistant. Provide detailed, safe, step-by-step guidance using metric units." },
        { role: "user", content: message }
      ]
    });

    const reply = out.choices?.[0]?.message?.content?.trim() || "I couldn't generate a reply.";
    res.json({ reply });
  } catch (e) {
    console.error("CHAT error:", e?.response?.data || e);
    res.status(500).json({ error: "Connection error." });
  }
});

/* ---------- Sunucu ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("listening on " + PORT));
