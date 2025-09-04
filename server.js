// server.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body parse
app.use(express.json());

// Statik dosyalar (frontend)
app.use(express.static(path.join(__dirname, "public")));

// CORS (frontend ayrı bir origin'den çağıracaksa whitelist ekle)
app.use(
  cors({
    origin: [
      /\.onrender\.com$/,
      /aqualifeai\.com$/,
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Sağlık kontrolü
app.get("/diag", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasKey: !!process.env.OPENAI_API_KEY,
    env: process.env.RENDER ? "render" : "local",
  });
});

// ---- Chat endpoint ----
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
      temperature: 0.6,
    });

    const reply =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I have no answer.";

    res.json({ reply });
  } catch (err) {
    console.error("CHAT ERR:", err?.response?.data || err);
    res.status(500).json({ error: "OpenAI API error" });
  }
});

// (Opsiyonel) SPA fallback
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
