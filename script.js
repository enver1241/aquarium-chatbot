
const API_BASE = "https://aquarium-chatbot.onrender.com";


export async function sendMessage(msg) {
  try {
    const r = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data.reply || "No reply";
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

// ---- REGISTER ----
export function bindRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value.trim();
    try {
      const r = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      alert("✅ Registered!");
      localStorage.setItem("user", username);
      location.href = "login.html";
    } catch (err) {
      alert("❌ " + err.message);
    }
  });
}


export function bindLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value.trim();
    try {
      const r = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      alert("✅ Welcome " + data.user.username);
      localStorage.setItem("user", data.user.username);
      location.href = "Chatbot.html";
    } catch (err) {
      alert("❌ " + err.message);
    }
  });
}


export function bindFeedbackForm() {
  const form = document.getElementById("feedbackForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim()
    };
    try {
      const r = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      location.href = "thanks.html";
    } catch (err) {
      alert("❌ " + err.message);
    }
  });
}
