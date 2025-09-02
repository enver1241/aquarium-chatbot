// server.js — AquaChat (Node 20+, Render-friendly)
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder?.("ipv4first"); // IPv6 önceliği sorunlarını önle

const fs = require("fs");
const path = require("path");
const os = require("os");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

// ---- APP
const app = express();
const PORT = (process.env.PORT && Number(process.env.PORT)) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.sqlite");

// ---- MIDDLEWARE
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
// <form method="POST"> (application/x-www-form-urlencoded) gövdelerini de al:
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Statik dosyaları projenin kökünden servis et (html/css/js/img)
app.use(express.static(__dirname));

// ---- DB
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  question TEXT,
  answer TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
try {
  const row = db.prepare("SELECT id FROM users WHERE username=?").get("admin");
  if (!row) {
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    db.prepare("INSERT INTO users (username,password_hash) VALUES (?,?)")
      .run("admin", bcrypt.hashSync(adminPass, 10));
    console.log("Seeded admin user with ADMIN_PASSWORD.");
  }
} catch (e) {
  console.warn("Admin seed failed:", e.message);
}

// ---- HELPERS
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- ROOT / HEALTH
// Ana sayfa: index.html varsa onu; yoksa Chatbot.html'i göster
app.get("/", (_req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  const fallbackPath = path.join(__dirname, "Chatbot.html");
  const file = fs.existsSync(indexPath) ? indexPath : fallbackPath;
  res.sendFile(file);
});

app.get("/diag", (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasKey: !!process.env.OPENAI_API_KEY,
    env: process.env.NODE_ENV || "production",
    db_file: DB_FILE
  });
});
app.get("/__version", (_req, res) => {
  res.json({
    ts: new Date().toISOString(),
    node: process.version,
    commit: process.env.RENDER_GIT_COMMIT || null,
    host: os.hostname()
  });
});
app.get("/dns-test", (_req, res) => {
  dns.lookup("api.openai.com", (err, address, family) => {
    res.json({ host: "api.openai.com", error: err ? String(err) : null, address, family });
  });
});
app.get("/net-test", a(async (_req, res) => {
  const out = {};
  try { out.cloudflare = (await fetch("https://1.1.1.1")).status; }
  catch (e) { out.cloudflare = String(e?.message || e); }
  try {
    out.openai = (await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}` }
    })).status;
  } catch (e) { out.openai = String(e?.message || e); }
  res.json(out);
}));
app.get("/probe-openai", a(async (_req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.json({ error: "no OPENAI_API_KEY" });
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    const text = await r.text();
    res.json({ ok: true, status: r.status, body: text.slice(0, 200) });
  } catch (e) {
    res.json({ error: "OpenAI probe failed", detail: String(e?.message || e) });
  }
}));
app.post("/admin-login", (req, res) => {
  const { password } = req.body;

  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "admin123";

  if (password === ADMIN_PASS) {
    res.sendFile(__dirname + "/admin.html");  // Şifre doğru → admin panel aç
  } else {
    res.status(401).send("Wrong password. <a href='/admin-login.html'>Try again</a>");
  }
});
app.get("/admin/feedback", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT id, COALESCE(name, email, username) AS username, message, created_at FROM feedback ORDER BY id DESC")
      .all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Database error", detail: String(e?.message || e) });
  }
});


// ---- API: AUTH & FEEDBACK
app.post("/register", a(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    db.prepare("INSERT INTO users (username,password_hash) VALUES (?,?)")
      .run(username, bcrypt.hashSync(password, 10));
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "User exists" });
    res.status(500).json({ error: "DB error", detail: String(e?.message || e) });
  }
}));

app.post("/login", a(async (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare("SELECT id,username,password_hash FROM users WHERE username=?").get(username || "");
  if (!row || !bcrypt.compareSync(password || "", row.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ ok: true, id: row.id, username: row.username });
}));

app.post("/feedback", a(async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Message required" });
  const info = db.prepare("INSERT INTO feedback (name,email,message) VALUES (?,?,?)")
    .run(name || null, email || null, message);
  res.json({ ok: true, id: info.lastInsertRowid });
}));

// ---- CHAT (OpenAI)
app.post("/chat", a(async (req, res) => {
  const { message, username } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are AquariumLife Assistant, expert in aquarium care. Answer briefly and clearly." },
        { role: "user", content: String(message) }
      ],
      temperature: 0.2
    })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${r.status} ${t}`);
  }

  const j = await r.json();
  const answer = j.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't answer.";
  db.prepare("INSERT INTO chat_logs (username,question,answer) VALUES (?,?,?)")
    .run(username || null, message, answer);
  res.json({ ok: true, answer });
}));

// ---- 404
app.use((_req, res) => res.status(404).send("Not Found"));

// ---- START (0.0.0.0 bağla; Render/Containers için güvenli)
app.listen(PORT, "0.0.0.0", () => console.log("listening on", PORT));
