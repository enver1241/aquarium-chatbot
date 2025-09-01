// -------- API BASE (aynı origin) --------
// Canlıda (aqualifeai.com) CORS sorunlarını önlemek için boş bırak.
// Yerelde farklı bir API vuracaksan, HTML'de script.js'den önce
// <script>window.API_BASE="http://localhost:3000"</script> yazabilirsin.
const API_BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "";

// --- küçük yardımcı: güvenli fetch + retry ---
async function safeFetch(path, opts = {}, retries = 1) {
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
  const { method = "GET", headers = {}, body } = opts;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ?? undefined,
  });

  if (!res.ok) {
    if (retries > 0 && [429, 502, 503, 504].includes(res.status)) {
      await new Promise(r => setTimeout(r, 900));
      return safeFetch(path, opts, retries - 1);
    }
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text}`);
  }

  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// --------- API çağrıları ----------
const api = {
  chat:     (message, username)       => safeFetch("/chat",     { method: "POST", body: JSON.stringify({ message, username }) }),
  register: (username, password)      => safeFetch("/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login:    (username, password)      => safeFetch("/login",    { method: "POST", body: JSON.stringify({ username, password }) }),
  feedback: (name, email, message)    => safeFetch("/feedback", { method: "POST", body: JSON.stringify({ name, email, message }) }),
};

// ======== Chat UI (varsa) ========
const chatForm  = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog   = document.getElementById("chat-log");

if (chatForm && chatInput && chatLog) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = (chatInput.value || "").trim();
    if (!msg) return;

    appendLine(`You: ${msg}`);
    chatInput.value = "";

    try {
      const username = localStorage.getItem("user") || null;
      const data = await api.chat(msg, username);
      const botText = (data && (data.answer || data.reply)) || "(empty)";
      appendLine(`Bot: ${botText}`);
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
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ======== Formları AJAX'la bağla ve başarıda yönlendir ========
function bindJSONForm(formSelector, endpointDefault, onSuccess) {
  const form = document.querySelector(formSelector);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    // klasik submit yerine JSON gönder
    e.preventDefault();
    const action = form.getAttribute("action") || endpointDefault || "/";
    const method = form.getAttribute("method") || "POST";
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    try {
      const res = await safeFetch(action, { method, body: JSON.stringify(data) });
      if (typeof onSuccess === "function") onSuccess(res, data, form);
      else alert("✅ Success");
    } catch (err) {
      console.error(err);
      alert("❌ " + (err?.message || err));
    }
  });
}

// Register → user/pass kaydet + Chatbot'a git
bindJSONForm("#registerForm", "/register", (_res, data) => {
  localStorage.setItem("user", data.username);
  localStorage.setItem("pass", data.password);
  window.location.href = "Chatbot.html";
});

// Login → user/pass kaydet + Chatbot'a git
bindJSONForm("#loginForm", "/login", (_res, data) => {
  localStorage.setItem("user", data.username);
  localStorage.setItem("pass", data.password);
  window.location.href = "Chatbot.html";
});

// Admin login → sabit admin için admin.html'e git
bindJSONForm("#adminLoginForm", "/login", (_res, _data) => {
  localStorage.setItem("user", "admin");
  // Güvenlik: admin şifresini saklamasan da olur.
  window.location.href = "admin.html";
});

// Feedback → teşekkür sayfası
bindJSONForm("#feedbackForm", "/feedback", () => {
  window.location.href = "thanks.html";
});

// Hızlı sağlık kontrolü (konsola log)
safeFetch("/diag")
  .then(d => console.log("diag:", d))
  .catch(e => console.warn("diag failed:", e?.message || e));

// ---- Fallback dedektörü için globale export et ----
window.bindJSONForm = bindJSONForm;
