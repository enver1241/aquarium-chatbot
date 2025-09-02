// script.js — safe event binding + fallbacks
(function () {
  const $ = (sel) => document.querySelector(sel);

  function domReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else fn();
  }

  function safeBind(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      // DO NOT preventDefault -> keep href fallback
      try { handler && handler(e); } catch (err) { console.error(err); }
    });
  }

  // App helpers
  function cleanupOnLogout() {
    try {
      localStorage.removeItem("isAdmin");
      localStorage.removeItem("user");
      localStorage.removeItem("lastThreadId");
      sessionStorage.clear();
    } catch (e) { console.warn(e); }
  }

  function cleanupOnNewChat() {
    try {
      sessionStorage.removeItem("chatHistory");
      localStorage.removeItem("lastThreadId");
      const list = document.getElementById("asked-questions");
      if (list) list.innerHTML = "";
      const chat = document.getElementById("chat-window");
      if (chat) chat.innerHTML = "";
    } catch (e) { console.warn(e); }
  }

  function appendMsg(role, text) {
    const win = $("#chat-window");
    if (!win) return;
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    win.appendChild(div);
    win.scrollTop = win.scrollHeight;
  }

  // Very light demo chat handler (keeps your backend free)
  async function handleSend() {
    const input = $("#chat-input");
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = "";
    appendMsg("user", text);
    // Demo: local bot response (replace with your fetch to /chat)
    let reply = "Bot: This is a demo reply. Hook me to your server /chat.";
    if (/betta/i.test(text)) {
      reply = "Bot: Betta fish like 24–28°C water, low flow, many hiding spots.";
    }
    appendMsg("bot", reply);
  }

  domReady(() => {
    // Global binds
    safeBind("logoutBtn", cleanupOnLogout);
    safeBind("newChatBtn", cleanupOnNewChat);
    safeBind("goChatbot", () => {});

    // Chat specific
    safeBind("sendBtn", handleSend);
    const input = $("#chat-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          $("#sendBtn")?.click();
        }
      });
    }
  });
})();
