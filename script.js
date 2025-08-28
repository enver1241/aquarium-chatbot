<<<<<<< HEAD
const API_BASE = "https://aquarium-chatbot.onrender.com"; // Render'daki servis URL'in

async function sendMessage(msg) {
  const r = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  });
  const data = await r.json();
  return data.reply || "Server unavailable!";
=======
function registerUser() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  localStorage.setItem("user", username);
  localStorage.setItem("pass", password);

  alert("✅ Registered successfully!");
  window.location.href = "login.html";
  return false;
}

function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const storedUser = localStorage.getItem("user");
  const storedPass = localStorage.getItem("pass");

  if (username === storedUser && password === storedPass) {
    alert("✅ Login successful!");
    window.location.href = "Chatbot.html";
  } else {
    alert("❌ Incorrect username or password.");
  }

  return false;
>>>>>>> c171be5 (fix: auth/login/feedback; switch to sqlite3; working chat API; frontend fetch)
}
