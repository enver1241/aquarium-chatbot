import express from 'express';
import cors from 'cors';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';

// 🌱 .env dosyasını yükle
dotenv.config();

// __dirname (ESM uyumlu)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

// 🔹 SQLite bağlantısı
const db = new sqlite3.Database('feedback.db', (err) => {
  if (err) {
    console.error('❌ Veritabanı bağlantı hatası:', err.message);
  } else {
    console.log('✅ SQLite veritabanına bağlanıldı.');
  }
});

// 🔹 feedback tablosunu oluştur
db.run(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('❌ Tablo oluşturulamadı:', err.message);
  } else {
    console.log('✅ feedback tablosu kontrol edildi veya oluşturuldu.');
  }
});

// 🔹 OpenAI API yapılandırması
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// 🔹 Chat endpoint (sadece akvaryum canlılarına özel)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mesaj eksik.' });
  }

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: "system",
          content: "You are an expert chatbot that ONLY answers questions about aquarium animals. If the user asks about anything else (like programming, history, sports), respond: 'I’m only designed to answer questions about aquarium creatures and related care. Please ask something related to aquarium life.'"
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const botReply = completion.data.choices[0].message.content;
    res.json({ reply: botReply });

  } catch (error) {
    console.error('❌ OpenAI API hatası:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Bot şu anda yanıt veremiyor.' });
  }
});

// 🔹 Geri bildirim gönderimi
app.post('/submit-problem', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).send('Lütfen tüm alanları doldurun.');
  }

  const stmt = db.prepare("INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)");
  stmt.run(name, email, message, (err) => {
    if (err) {
      console.error('❌ Veritabanı hatası:', err.message);
      return res.status(500).send('Veritabanı hatası oluştu.');
    }

    console.log('✅ Geri bildirim veritabanına kaydedildi.');
    res.redirect('/thanks.html');
  });
});

// 🔹 Tüm feedback kayıtlarını getir (admin için)
app.get('/api/feedbacks', (req, res) => {
  db.all("SELECT * FROM feedback", (err, rows) => {
    if (err) {
      console.error('❌ Veritabanı okuma hatası:', err.message);
      return res.status(500).json({ error: 'Veritabanı hatası.' });
    }
    res.json(rows);
  });
});

// 🔹 Sayfa yönlendirmeleri
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/welcome.html', (req, res) => res.sendFile(path.join(__dirname, 'welcome.html')));
app.get('/problem.html', (req, res) => res.sendFile(path.join(__dirname, 'problem.html')));
app.get('/thanks.html', (req, res) => res.sendFile(path.join(__dirname, 'thanks.html')));
app.get('/chatbot.html', (req, res) => res.sendFile(path.join(__dirname, 'Chatbot.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin-login.html', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));

// Tarayıcı istek bastırması
app.get('/chat', (req, res) => {
  res.status(204).send(); // No Content
});

// 🔹 Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`🚀 Sunucu aktif: http://localhost:${PORT}`);
});
node_modules
.env
.db
feedback.db

