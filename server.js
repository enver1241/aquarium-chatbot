// server.js — Stable production server for Aquarium Chatbot (CommonJS, Node >=18)

require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first"); // IPv4'ü öne al

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const sqlite3 = require("sqlite3").verbose();
const { OpenAI } = require("openai");
const { Agent, setGlobalDispatcher, fetch } = require("undici");

// ---- Undici: IPv4 + makul timeout/pipelining
setGlobalDispatcher(new Agent({
  connect: { timeout: 30_000, family: 4 },
  headersTimeout: 60_000,
  bodyTimeout: 120_000,
  keepAliveTimeout: 10_000,
  pipelining: 1,
}));

const app = express();
app.set("trust proxy", 1);

// CORS
app.use(cors({
  origin: ["https://aquarium-chatbot.onrender.com", "https://aqualifeai.com"],
  methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "1mb" }));

// Ek güvenlik başlıkları
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Rate-limit
app.use(rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Minimal istek logu
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==== SQLite
const db = new sqlite3.Database("./db.sqlite");
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ==== OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// async wrapper
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ==== Health
app.get("/", (_req, res) => res.type("text/plain").send("ok"));

app.get("/diag", (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    env: process.env.RENDER ? "render" : (process.env.NODE_ENV || "dev"),
    hasKey: !!process.env.OPENAI_API_KEY,
    keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 7) : null,
  });
});

// ==== Probe: OpenAI egress testi (hep JSON döner)
app.get("/probe-openai", a(async (_req, res) => {
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    const text = await r.text();
    res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      bodyStart: text.slice(0, 200),
    });
  } catch (e) {
    console.error("PROBE error:", e.name, e.code, e.message, e.cause?.code);
    res.status(502).json({
      ok: false,
      name: e.name,
      code: e.code || e.cause?.code || null,
      message: e.message,
    });
  }
}));

// ==== Models (erişim testi)
app.get("/models", a(async (_req, res) => {
  try {
    const list = await openai.models.list();
    res.json({ ok: true, count: list.data?.length ?? 0 });
  } catch (e) {
    console.error("Models error:", e?.status, e?.message);
    res.status(e?.status || 502).json({ error: "Connection error.", details: null });
  }
}));

// ==== Chat
app.post("/chat", a(async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message required" });
  }

  try {
    const r = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: "You are AquaChat, a helpful aquarium assistant. Keep answers concise." },
        { role: "user", content: message },
      ],
      temperature: 0.4,
      max_output_tokens: 400,
    });

    const reply =
      (r.output_text && r.output_text.trim()) ||
      (r.output?.[0]?.content?.[0]?.text?.value?.trim()) ||
      "No reply";

    res.json({ reply });
  } catch (e) {
    console.error("OpenAI error:", e?.status, e?.message);
    if (e?.response?.data) console.error("OpenAI response:", e.response.data);
    res.status(e?.status || 502).json({ error: "Connection error.", details: null });
  }
}));

// ==== Basit Auth
app.post("/register", a((req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  db.run("INSERT INTO users (username,password) VALUES (?,?)", [username, password], function (err) {
    if (err) {
      if (String(err).includes("UNIQUE")) return res.status(409).json({ error: "User exists" });
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ ok: true, id: this.lastID });
  });
}));

app.post("/login", a((req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  db.get("SELECT id,username FROM users WHERE username=? AND password=?", [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!row) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ ok: true, user: row });
  });
}));

// ==== Feedback
app.post("/feedback", a((req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: "Missing fields" });

  db.run("INSERT INTO feedback (name,email,message) VALUES (?,?,?)", [name, email, message], function (err) {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ ok: true, id: this.lastID });
  });
}));

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Hata yakalama
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal error" });
});

// Start
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`listening on ${PORT}`));

// Graceful shutdown
const shutdown = (sig) => () => {
  console.log(`${sig} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
