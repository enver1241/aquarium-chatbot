const API_BASE = "https://aquarium-chatbot.onrender.com"; // Render'daki servis URL'in

async function sendMessage(msg) {
  const r = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  });
  const data = await r.json();
  return data.reply || "Server unavailable!";
}
