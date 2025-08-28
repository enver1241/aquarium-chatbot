
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.options("*", cors());
app.use(express.json());
app.use(cors());
app.options("*", cors());
app.use(express.json());



const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Teşhis endpoint'leri ===
app.get("/diag", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasKey: !!process.env.OPENAI_API_KEY,
    keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 7) : null,
    env: process.env.RENDER ? "render" : "local"
  });
});

app.get("/models", async (req, res) => {
  try {
    // basit bir istek: modelleri say
    const list = await openai.models.list();
    res.json({ count: list.data.length });
  } catch (e) {
    console.error("Models error:", e.status, e.message, e.response?.data);
    res.status(e.status || 500).json({ error: e.message, details: e.response?.data });
  }
});

// === Chat (Responses API) ===
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message required" });

    // Responses API (önerilen)
    const r = await openai.responses.create({
      model: "gpt-4o-mini",
      input: message
    });

    // output_text: SDK helper (4.54+)
    const reply =
      (r.output_text && r.output_text.trim()) ||
      (r.output?.[0]?.content?.[0]?.text?.value) ||
      "No reply";

    return res.json({ reply });
  } catch (e) {
    // Render loglarında net gözüksün
    console.error("OpenAI error:", e.status, e.message);
    if (e.response?.data) console.error("OpenAI response:", e.response.data);

    // İstemciye gerçek hatayı döndür
    return res.status(e.status || 500).json({
      error: e.message || "OpenAI error",
      details: e.response?.data || null
    });
  }
});

// health
app.get("/", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("listening on " + PORT));
app.get("/diag", (req,res)=>res.json({
  ok:true,
  node:process.version,
  hasKey: !!process.env.OPENAI_API_KEY
}));

app.get("/models", async (req,res)=> {
  try {
    const list = await openai.models.list();
    res.json({ count: list.data.length });
  } catch (e) {
    res.status(e.status||500).json({ error: e.message, details: e.response?.data });
  }
});

app.post("/chat", async (req,res)=> {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message required" });
    const r = await openai.responses.create({ model:"gpt-4o-mini", input: message });
    const reply = r.output_text?.trim() || "No reply";
    res.json({ reply });
  } catch (e) {
    res.status(e.status||500).json({ error: e.message, details: e.response?.data });
  }
});
