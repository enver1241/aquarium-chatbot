// server.js — Aquarium Chatbot (stable + debug)
// ------------------------------------------------
require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder?.("ipv4first"); // Node v18+ için

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const path = require("path");
const { OpenAI } = require("openai");
const { Agent, setGlobalDispatcher, fetch } = require("undici");
const Database = require("better-sqlite3");
const os = require("os");
app.get("/dns-test", (req, res) => {
  dns.lookup("api.openai.com", (err, address, family) => {
    res.json({
      host: "api.openai.com",
      error: err ? String(err) : null,
      address, family,
      hostname: os.hostname()
    });
  });
});

// ---- HTTP agent (Render zaman aşımları için makul değerler)
setGlobalDispatcher(new Agent({
  connect: { timeout: 30_000 },
  headersTimeout: 30_000,
  bodyTimeout: 60_000
}));

// ---- DB init
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.sqlite");
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

const app = express();

// ---- Security & CORS
app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-key"]
}));
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({ windowMs: 60_000, max: 90 });
app.use(limiter);

// ---- Static (lokalde HTML’leri buradan servis etmek için)
app.use(express.static(__dirname));

// ---- OpenAI client (SDK) — fallback olarak raw fetch da var
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// küçük yardımcı
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- Health
app.get("/", (_req, res) => res.type("text/plain").send("ok"));
app.get("/diag", a(async (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasKey: !!process.env.OPENAI_API_KEY,
    env: process.env.NODE_ENV || "local",
    db_file: DB_FILE
  });
}));
// server.js içine (diag'ın altına bir yerlere)
app.get("/version", (_req, res) => {
  res.json({
    time: new Date().toISOString(),
    node: process.version,
    commit: process.env.RENDER_GIT_COMMIT || null
  });
});

// ---- Ağ debug (egress testi)
app.get("/net-test", a(async (_req, res) => {
  const out = {};
  try {
    const r = await fetch("https://1.1.1.1");
    out.cloudflare = r.status;
  } catch (e) {
    out.cloudflare = String(e?.message || e);
  }
  try {
    const r2 = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    out.openai = r2.status;
  } catch (e) {
    out.openai = String(e?.message || e);
  }
  res.json(out);
}));
app.get("/__version", (_req, res) => {
  res.json({
    ts: new Date().toISOString(),
    node: process.version,
    commit: process.env.RENDER_GIT_COMMIT || null
  });
});

// ---- Probe (ham fetch + SDK) — ayrıntılı hata gösterir
app.get("/probe-openai", a(async (_req, res) => {
  try {
    // 1) Ham fetch
    const r1 = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    const text1 = await r1.text();

    // 2) SDK testi
    let sdk = null, sdkErr = null;
    try {
      const resp = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: "Say ok" }],
        max_tokens: 4,
      });
      sdk = { model: resp.model, sample: resp.choices?.[0]?.message?.content || null };
    } catch (e) {
      sdkErr = { msg: String(e?.message || e), code: e?.code, cause: e?.cause?.code };
    }

    res.json({
      ok: true,
      rawFetch: { status: r1.status, body: text1.slice(0, 200) },
      sdk, sdkErr
    });
  } catch (e) {
    res.status(500).json({
      error: "probe failed",
      detail: String(e?.message || e),
      code: e?.code || e?.name,
      cause: e?.cause?.code || e?.cause?.errno
    });
  }
}));

// ---- Models (SDK üstünden) — bağlantı hatasını net verir
app.get("/models", a(async (_req, res) => {
  try {
    const list = await openai.models.list();
    res.json({ ok: true, total: list.data.length, models: list.data.slice(0, 10).map(m => m.id) });
  } catch (e) {
    res.status(500).json({ error: "OpenAI connection error", detail: String(e.message || e) });
  }
}));

// ---- Auth helpers
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const toHash = (pw) => bcrypt.hashSync(pw, 10);
const verify = (pw, hash) => bcrypt.compareSync(pw, hash);

// Seed admin
try {
  const row = db.prepare("SELECT id FROM users WHERE username=?").get("admin");
  if (!row) {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?,?)")
      .run("admin", toHash(ADMIN_PASSWORD));
    console.log("Seeded default admin user with ADMIN_PASSWORD.");
  }
} catch (e) {
  console.warn("Admin seed failed:", e.message);
}

// ---- Register
app.post("/register", a(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?,?)")
      .run(username, toHash(password));
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "User exists" });
    res.status(500).json({ error: "DB error", detail: String(e.message || e) });
  }
}));

// ---- Login
app.post("/login", a(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  const row = db.prepare("SELECT id, username, password_hash FROM users WHERE username=?").get(username);
  if (!row) return res.status(401).json({ error: "Invalid credentials" });
  if (!verify(password, row.password_hash)) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ ok: true, id: row.id, username: row.username });
}));

// ---- Feedback
app.post("/feedback", a(async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Message required" });
  const info = db.prepare("INSERT INTO feedback (name,email,message) VALUES (?,?,?)")
    .run(name || null, email || null, message);
  res.json({ ok: true, id: info.lastInsertRowid });
}));

// ---- Admin
app.post("/admin/login", a(async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Missing password" });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  res.json({ ok: true, token: "admin" });
}));

app.get("/admin/feedbacks", a(async (req, res) => {
  const key = req.headers["x-admin-key"] || req.query.token;
  if (key !== "admin") return res.status(401).json({ error: "Unauthorized" });
  const rows = db.prepare("SELECT id,name,email,message,created_at FROM feedback ORDER BY id DESC").all();
  res.json({ ok: true, rows });
}));

// ---- CHAT (RAW FETCH FALLBACK — SDK yerine doğrudan HTTP)
app.post("/chat", a(async (req, res) => {
  const { message, username } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are AquariumLife Assistant, expert in aquarium animals, care, water parameters, compatibility, and troubleshooting. Answer briefly and clearly." },
          { role: "user", content: String(message) }
        ],
        temperature: 0.2
      })
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${r.status} ${txt}`);
    }

    const j = await r.json();
    const answer = j.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't answer.";
    db.prepare("INSERT INTO chat_logs (username,question,answer) VALUES (?,?,?)")
      .run(username || null, message, answer);
    res.json({ ok: true, answer });
  } catch (e) {
    res.status(500).json({ error: "OpenAI error", detail: String(e?.message || e) });
  }
}));

// ---- Error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error", detail: String(err.message || err) });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`listening on ${PORT}`));

const shutdown = (sig) => () => {
  console.log(`${sig} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
