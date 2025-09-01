// server.js — AquaChat (Node 20+)
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder?.("ipv4first");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");


app.use(helmet({
  contentSecurityPolicy: false,           // inline <script>, onclick vs. çalışsın
  crossOriginEmbedderPolicy: false,       // bazı tarayıcı/görsel sorunlarını engelle
}));

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.sqlite");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // <form> gövdesi için ŞART
app.use(rateLimit({ windowMs: 60_000, max: 100 }));
app.use(express.static(__dirname)); // html/js/css

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

const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// health
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/diag", (_req, res) => res.json({
  ok: true, node: process.version,
  hasKey: !!process.env.OPENAI_API_KEY,
  env: process.env.NODE_ENV || "production",
  db_file: DB_FILE
}));
app.get("/__version", (_req, res) => res.json({
  ts: new Date().toISOString(),
  node: process.version,
  commit: process.env.RENDER_GIT_COMMIT || null,
  host: os.hostname()
}));

// auth + feedback
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

// chat
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

// 404
app.use((_req, res) => res.status(404).send("Not Found"));

app.listen(PORT, () => console.log("listening on", PORT));
