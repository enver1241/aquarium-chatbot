// public/script.js
const $ = (s) => document.querySelector(s);
const log = $("#log");
const form = $("#chatForm");
const input = $("#msg");
const sendBtn = $("#sendBtn");

// Demo metin YOK! Gerçek /chat çağrısı var.
function addBubble(text, who = "bot") {
  const li = document.createElement("li");
  li.className = "bubble " + (who === "you" ? "you" : "bot");
  li.textContent = (who === "you" ? "You: " : "Bot: ") + text;
  log.appendChild(li);
  log.scrollTop = log.scrollHeight;
}

async function callChatAPI(message) {
  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    credentials: "include"
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${err}`);
  }
  return res.json(); // { reply }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addBubble(text, "you");
  input.value = "";
  input.focus();
  sendBtn.disabled = true;

  try {
    const data = await callChatAPI(text);
    addBubble(data.reply || "No reply.");
  } catch (err) {
    console.error(err);
    addBubble("Server error. Please try again.");
  } finally {
    sendBtn.disabled = false;
  }
});
