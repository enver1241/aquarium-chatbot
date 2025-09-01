// -------- API BASE (aynı origin) --------
// Custom domain'de CORS derdi yaşamamak için default '' (aynı host)
const API_BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "";

// --- küçük yardımcı: güvenli fetch + retry ---
async function safeFetch(path, opts = {}, retries = 1) {
  // path mutlak URL ise aynen kullan; değilse API_BASE + path yap
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
  chat:  (message)                 => safeFetch("/chat",     { method: "POST", body: JSON.stringify({ message }) }),
  register: (username, password)   => safeFetch("/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login:    (username, password)   => safeFetch("/login",    { method: "POST", body: JSON.stringify({ username, password }) }),
  feedback: (name, email, message) => safeFetch("/feedback", { method: "POST", body: JSON.stringify({ name, email, message }) }),
};

// ======== Chat UI (varsa) ========
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
      const data = await api.chat(msg);
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
}

// ======== Formları AJAX'la bağla (varsa) ========
function bindJSONForm(formSelector, endpointDefault) {
  const form = document.querySelector(formSelector);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Formun action'ı varsa onu kullan; yoksa endpointDefault
    const action = form.getAttribute("action") || endpointDefault;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await safeFetch(action, {
        method: form.getAttribute("method") || "POST",
        body: JSON.stringify(data),
      });
      alert("✅ Success");
      // İsteğe bağlı: form.reset();
    } catch (err) {
      console.error(err);
      alert("❌ " + (err?.message || err));
    }
  });
}

// Bu id'leri HTML'lerde verdik:
bindJSONForm("#registerForm", "/register");
bindJSONForm("#loginForm", "/login");
bindJSONForm("#adminLoginForm", "/login");
bindJSONForm("#feedbackForm", "/feedback");

// Hızlı sağlık kontrolü (konsola log)
safeFetch("/diag")
  .then(d => console.log("diag:", d))
  .catch(e => console.warn("diag failed:", e?.message || e));
