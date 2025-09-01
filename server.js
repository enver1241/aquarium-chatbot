// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import OpenAI from "openai";

// ---- DB init (better-sqlite3, senkron) ----
const db = new Database("./db.sqlite"); // dosya yoksa oluşturur
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ---- App ----
const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://aqualifeai.com","https://www.aqualifeai.com"],
  methods: ["GET","POST"],
  credentials: false
}));

// ---- Healthcheck ----
app.get("/", (_req, res) => res.send("ok"));

// ---- Auth ----
app.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, password);
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "User exists" });
    console.error(e);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare(
    "SELECT id, username FROM users WHERE username = ? AND password = ?"
  ).get(username, password);

  if (!row) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ ok: true, user: row });
});

// ---- Feedback ----
app.post("/feedback", (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: "Missing fields" });

  try {
    db.prepare("INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)").run(name, email, message);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error" });
  }
});

// ---- Chatbot ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message required" });

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are Aquarium Assistant. Be concise." },
        { role: "user", content: message }
      ]
    });

    res.json({ reply: r.choices?.[0]?.message?.content || "No reply" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI error" });
  }
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("listening on " + PORT));
