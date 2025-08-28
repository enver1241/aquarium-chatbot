import express from "express";
import cors from "cors";
import { OpenAI } from "openai";

const app = express();
app.use(cors({
  origin: ["https://aqualifeai.com","https://www.aqualifeai.com"],
  methods: ["GET","POST"]
}));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/health", (req,res)=>res.send("ok"));

app.post("/api/chat", async (req,res) => {
  try {
    const user = req.body.message || "";
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: user }]
    });
    res.json({ reply: r.choices[0]?.message?.content ?? "" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "ai_error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server started on", PORT));
