const API_BASE = "https://aquarium-chatbot.onrender.com";

// ---- Chat ----
export async function sendMessage(msg) {
  const r = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  });
  const data = await r.json();
  return data.reply || data.error || "Server unavailable";
}

// ---- Register ----
export function bindRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value.trim();
    const r = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (data.ok) {
      alert("✅ Registered!");
      localStorage.setItem("user", username);
      location.href = "login.html";
    } else alert("❌ " + (data.error || "Register failed"));
  });
}

// ---- Login ----
export function bindLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value.trim();
    const r = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (data.ok) {
      alert("✅ Welcome " + data.user.username);
      localStorage.setItem("user", data.user.username);
      location.href = "Chatbot.html";
    } else alert("❌ " + (data.error || "Login failed"));
  });
}

// ---- Feedback ----
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
    const r = await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (data.ok) location.href = "thanks.html";
    else alert("❌ " + (data.error || "Send failed"));
  });
}
