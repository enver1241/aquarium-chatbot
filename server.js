import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

// CORS: kendi domainlerin
const allowed = ["https://aqualifeai.com", "https://www.aqualifeai.com"];
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: false
}));

app.use(express.json());

// OpenAI client (ANAHTAR .env'den gelecek)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Sağlık kontrolü
app.get("/health", (req, res) => res.send("ok"));

// Sohbet endpoint'i
app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body?.message || "").toString().slice(0, 2000);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an aquarium expert. Answer clearly." },
        { role: "user", content: userMessage }
      ],
      temperature: 0.4
    });

    const reply = completion.choices?.[0]?.message?.content ?? "I couldn't reply.";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI error" });
  }
});

// Render/Node port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
