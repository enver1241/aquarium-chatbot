# 🌊 AquaLifeAI

**AquaLifeAI** is an AI-powered chatbot and management platform designed for aquarium enthusiasts.  
Users can register, log in, customize their profiles, upload avatars, and chat with an intelligent assistant about fish care, aquarium maintenance, and more.

---

## 🌐 Live Website

🔗 **[www.aqualifeai.com](https://www.aqualifeai.com)**  
Visit the live site to create a free account and start using AquaLifeAI instantly.

---

## 🚀 Features

- 🧠 **AI Chatbot:** Smart aquarium assistant powered by OpenAI  
- 👤 **User Accounts:** Registration, login, logout, and profile editing  
- 🖼️ **Profile Avatars:** Users can upload and update their own profile pictures  
- 💬 **Feedback Form:** Collects feedback from users and stores it in the database  
- 🌐 **Multi-language Support:** English 🇬🇧 and Polish 🇵🇱 toggle  
- 🛡️ **Security:** Helmet, express-session, bcrypt, and rate-limiting  
- 📦 **Database:** Fast and reliable `better-sqlite3` storage  
- 💻 **Modern Responsive UI:** Works across desktop and mobile devices

---

## ⚙️ Tech Stack

- **Backend:** Node.js (Express.js)
- **Database:** better-sqlite3
- **Authentication:** express-session + better-sqlite3-session-store
- **AI API:** OpenAI Responses API (GPT-4o-mini)
- **Security:** Helmet, CORS, Rate Limiter, bcrypt
- **Frontend:** HTML, CSS, Vanilla JavaScript

---

## 📁 Local Development Setup

```bash
# Clone the repository
git clone https://github.com/enver1241/aqualifeai.com.git
cd aqualifeai.com

# Install dependencies
npm install

# Set your environment variables
echo "OPENAI_API_KEY=sk-..." > .env

# Start the server
node server.js

Owener BY : ENVER GİDİCİ 