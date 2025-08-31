// === API base ===
// Varsayılan Render API adresi:
const DEFAULT_REMOTE_BASE = "https://aquarium-chatbot.onrender.com";
// İstersen HTML'de script'ten ÖNCE:  <script>window.API_BASE="http://localhost:3000"</script>
const API_BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : DEFAULT_REMOTE_BASE;

// ---- küçük yardımcı: güvenli fetch + retry ----
async function safeFetch(path, opts = {}, retries = 1) {
  const url = `${API_BASE}${path}`;
  const {
    method = "GET",
    headers = {},
    body,
  } = opts;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ?? undefined,
    });

    // Geçici hatalarda 1 kez daha dene
    if (!res.ok) {
      if (retries > 0 && [429, 502, 503, 504].includes(res.status)) {
        await new Promise(r => setTimeout(r, 900));
        return safeFetch(path, opts, retries - 1);
      }
      // Hata içeriğini göster
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${text}`);
    }

    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  } catch (err) {
    console.error("safeFetch error:", err?.message || err);
    throw err;
  }
}

// === API çağrıları ===
async function sendChatMessage(message) {
  return safeFetch("/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

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

async function sendFeedback(name, email, message) {
  return safeFetch("/feedback", {
    method: "POST",
    body: JSON.stringify({ name, email, message }),
  });
}

// ======== Basit UI bağlama ========
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
      // Sunucu { ok, answer } döndürüyor; eski sürümler için reply fallback
      const botText = (data && (data.answer || data.reply)) || "(empty)";
      appendLine(`Bot: ${botText}`);
    } catch (err) {
      appendLine("Bot: Server unavailable!");
    }
  });
}

function appendLine(text) {
  const p = document.createElement("p");
  p.textContent = text;
  chatLog.appendChild(p);
}

// Hızlı sağlık kontrolü (konsola loglar)
safeFetch("/diag")
  .then(d => console.log("diag:", d))
  .catch(e => console.warn("diag failed:", e?.message || e));
