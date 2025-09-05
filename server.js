// server.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");

// OpenAI CJS/ESM uyumlu import
const _OpenAI = require("openai");
const OpenAI = _OpenAI.OpenAI || _OpenAI;

if (!process.env.OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY not set. /chat will return 500.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 gün
    },
  })
);

// Statik dosyalar
app.use(express.static(__dirname));

// Uploads klasörü
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

// Sağlık
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------- DB ---------------- */
const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  if (req.accepts("html")) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/Chatbot.html");
    return res.redirect(`/login.html?next=${nextUrl}`);
  }
  return res.status(401).json({ error: "Unauthorized" });
}

/* --------------- Auth --------------- */
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

app.post("/register", async (req, res) => {
  try {
    const { email, password, display_name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });
    const hash = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users(email, password_hash, display_name) VALUES (?,?,?)",
      [email.toLowerCase(), hash, display_name || email.split("@")[0]],
      function (err) {
        if (err) {
          if (String(err).includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
          return res.status(500).json({ error: "DB error" });
        }
        req.session.userId = this.lastID;
        res.json({ ok: true });
      }
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  db.get("SELECT id, password_hash FROM users WHERE email = ?", [email.toLowerCase()], async (err, row) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!row) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    req.session.userId = row.id;
    res.json({ ok: true });
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("aquabot.sid");
    res.json({ ok: true });
  });
});

/* -------------- Profile -------------- */
app.get("/profile", requireAuth, (req, res) => {
  db.get("SELECT id, email, display_name, avatar_url FROM users WHERE id = ?", [req.session.userId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });
});

app.put("/profile", requireAuth, (req, res) => {
  const { display_name } = req.body || {};
  db.run("UPDATE users SET display_name = ? WHERE id = ?", [display_name, req.session.userId], function (err) {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ ok: true });
  });
});

// Avatar upload (multer fix)
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, "avatar_" + Date.now() + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
}).single("avatar");

app.post("/profile/avatar", requireAuth, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: String(err.message || err) });
    const rel = "/uploads/" + path.basename(req.file.path);
    db.run("UPDATE users SET avatar_url = ? WHERE id = ?", [rel, req.session.userId], (e2) => {
      if (e2) return res.status(500).json({ error: "DB error" });
      res.json({ ok: true, avatar_url: rel });
    });
  });
});

/* -------------- Feedback -------------- */
app.post("/feedback", requireAuth, (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Message required" });
  db.run("INSERT INTO feedbacks(user_id, message) VALUES(?,?)", [req.session.userId, message], function (err) {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ ok: true, id: this.lastID });
  });
});

/* ----------- Teşhis (env & OpenAI) ----------- */
app.get("/diag", (req, res) => {
  const key = process.env.OPENAI_API_KEY || "";
  res.json({
    ok: true,
    node: process.version,
    hasKey: Boolean(key),
    keyPrefix: key ? key.slice(0, 6) : null,
    env: process.env.RENDER ? "render" : (process.env.NODE_ENV || "local"),
    loggedIn: Boolean(req.session?.userId),
  });
});

app.get("/probe-openai", async (_req, res) => {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: "Say only: pong" // min token kısıtı yok; alanı kaldırdık
    });
    res.json({ ok: true, text: String(r.output_text || "").trim() });
  } catch (e) {
    console.error("probe-openai:", e?.message || e);
    res.status(502).json({ ok: false, error: e?.response?.data || e?.message || String(e) });
  }
});

/* --------------- Chatbot --------------- */
app.get("/Chatbot.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "Chatbot.html"));
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: "Missing message" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: "You are AquaLifeAI, an aquarium assistant for hobbyists. Keep answers concise and practical. Reply multilingual when asked." },
        { role: "user", content: message }
      ],
      temperature: 0.3,
      max_output_tokens: 600
    });

    const reply =
      (r.output_text && String(r.output_text).trim()) ||
      (r.choices?.[0]?.message?.content?.trim()) ||
      "I couldn't generate a reply.";

    res.json({ reply });
  } catch (e) {
    console.error("Chat error:", e?.response?.data || e?.message || e);
    res.status(500).json({ error: "Connection error." });
  }
});

/* --------------- Root/404 --------------- */
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use((req, res) => res.status(404).send("Not Found"));

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
