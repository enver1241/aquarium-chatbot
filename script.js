// === API base (Render) ===
const API_BASE = "https://aquarium-chatbot.onrender.com";

// Basit yardımcı: güvenli fetch + geri deneme
async function safeFetch(path, options = {}, retries = 1) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    // 502/503 gibi durumlarda 1 kez tekrar dene
    if (!res.ok) {
      if (retries > 0 && [429, 502, 503, 504].includes(res.status)) {
        await new Promise(r => setTimeout(r, 1000));
        return safeFetch(path, options, retries - 1);
      }
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${text}`);
    }
    // JSON beklediğimiz uçlar
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  } catch (err) {
    throw err;
  }
}

// === CHAT ===
async function sendChatMessage(message) {
  const body = JSON.stringify({ message });
  return safeFetch("/chat", { method: "POST", body });
}

// === LOGIN / REGISTER ===
async function register(username, password) {
  return safeFetch("/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
async function login(username, password) {
  return safeFetch("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// === FEEDBACK ===
async function sendFeedback(name, email, message) {
  return safeFetch("/feedback", {
    method: "POST",
    body: JSON.stringify({ name, email, message }),
  });
}

/* ======== UI bağlama (örnek) ======== */
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");

if (chatForm && chatInput && chatLog) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = (chatInput.value || "").trim();
    if (!msg) return;

    appendLine(`You: ${msg}`);
    chatInput.value = "";
    try {
      const data = await sendChatMessage(msg);
      appendLine(`Bot: ${data.reply || "(empty)"}`);
    } catch (err) {
      console.error(err);
      appendLine("Bot: Server unavailable!");
    }
  });
}

function appendLine(text) {
  const p = document.createElement("p");
  p.textContent = text;
  chatLog.appendChild(p);
}

/* Hızlı sağlık kontrolü – sayfa yüklenince konsola yazar */
safeFetch("/diag")
  .then(d => console.log("diag:", d))
  .catch(e => console.warn("diag failed:", e.message));
