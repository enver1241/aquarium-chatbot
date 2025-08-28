const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// DB
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

// Health
app.get("/", (_req, res) => res.send("ok"));

// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  db.run("INSERT INTO users (username,password) VALUES (?,?)", [username,password], function(err){
    if (err) {
      if (String(err).includes("UNIQUE")) return res.status(409).json({ error: "User exists" });
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ ok:true, id:this.lastID });
  });
});

// Login
app.post("/login", (req,res)=>{
  const { username, password } = req.body || {};
  db.get("SELECT id,username FROM users WHERE username=? AND password=?", [username,password], (err,row)=>{
    if(err) return res.status(500).json({ error:"DB error" });
    if(!row) return res.status(401).json({ error:"Invalid credentials" });
    res.json({ ok:true, user:row });
  });
});

// Feedback
app.post("/feedback", (req,res)=>{
  const { name,email,message } = req.body || {};
  if(!name||!email||!message) return res.status(400).json({ error:"Missing fields" });
  db.run("INSERT INTO feedback (name,email,message) VALUES (?,?,?)",[name,email,message],function(err){
    if(err) return res.status(500).json({ error:"DB error" });
    res.json({ ok:true, id:this.lastID });
  });
});

// Chat
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req,res)=>{
  try {
    const { message } = req.body || {};
    if(!message) return res.status(400).json({ error:"Message required" });

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[
        { role:"system", content:"You are Aquarium Assistant." },
        { role:"user", content:message }
      ]
    });
    res.json({ reply: r.choices?.[0]?.message?.content || "No reply" });
  } catch(e){
    console.error(e);
    res.status(500).json({ error:"OpenAI error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log("listening on " + PORT));
