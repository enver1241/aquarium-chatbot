// ============ helpers ============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function domReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else fn();
}

function bindAll(selector, handler) {
  $$(selector).forEach((el) =>
    el.addEventListener("click", (e) => {
      try { handler && handler(e); } catch (err) { console.error(err); }
    })
  );
}

function safeBind(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    try { handler && handler(e); } catch (err) { console.error(err); }
  });
}

// ============ app utilities ============

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
    const list = $("#asked-questions");
    if (list) list.innerHTML = "";
    const chat = $("#chat-window");
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

async function handleSend() {
  const input = document.querySelector("#chat-input");
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = "";
  appendMsg("user", text);

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Chat error");
    appendMsg("bot", data.reply || "…");
  } catch (e) {
    appendMsg("bot", "Bot: Connection error.");
  }
}


// ============ navbar (responsive + state) ============

function setupResponsiveNavbar() {
  const btn = $(".nav-toggle");
  const menu = $("#navMenu");
  if (!btn || !menu) return;

  const closeMenu = () => {
    menu.classList.remove("open");
    document.body.classList.remove("nav-open");
    btn.setAttribute("aria-expanded", "false");
  };
  const openMenu = () => {
    menu.classList.add("open");
    document.body.classList.add("nav-open");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener("click", () => {
    menu.classList.contains("open") ? closeMenu() : openMenu();
  });

  // Linke basınca kapan
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });

  // Esc ile kapan
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

function markActiveNav() {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const map = {
    "index.html": "navHome",
    "chatbot.html": "navChatbot",
    "feedback.html": "navFeedback",
    "problem.html": "navReport",
    "admin.html": "navAdmin",
    "login.html": "navLogin",
    "register.html": "navRegister",
  };
  const el = document.getElementById(map[path]);
  if (el) el.setAttribute("aria-current", "page");
}

function showAdminIfLogged() {
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const adminLink = document.getElementById("navAdmin");
  if (adminLink) adminLink.classList.toggle("hidden", !isAdmin);
}

function renderNavUser(user) {
  const nav = $(".nav-links");
  if (!nav) return;

  const login = $("#navLogin");
  const register = $("#navRegister");
  if (login) login.style.display = user ? "none" : "";
  if (register) register.style.display = user ? "none" : "";

  if (user) {
    let prof = $("#navProfile");
    if (!prof) {
      prof = document.createElement("a");
      prof.id = "navProfile";
      prof.href = "profile.html";
      nav.insertBefore(prof, nav.firstChild.nextSibling);
    }
    prof.textContent = user.display_name || user.email;

    let img = $("#navAvatar");
    if (!img) {
      img = document.createElement("img");
      img.id = "navAvatar";
      Object.assign(img.style, {
        width: "28px", height: "28px", borderRadius: "50%",
        objectFit: "cover", marginLeft: "6px"
      });
      prof.after(img);
    }
    img.src = user.avatar_url || "/uploads/default-avatar.png";
  }
}

async function hydrateNavbar() {
  showAdminIfLogged();
  markActiveNav();
  try {
    const resp = await fetch("/auth/me");
    const data = await resp.json();
    if (data.loggedIn) renderNavUser(data.user);
  } catch {}
}

// ============ page-specific ============

function guardChatbotPage() {
  if (!/chatbot\.html$/i.test(location.pathname)) return;
  fetch("/auth/me")
    .then((r) => r.json())
    .then((d) => {
      if (!d.loggedIn) {
        const nextUrl = encodeURIComponent("Chatbot.html");
        location.href = `login.html?next=${nextUrl}`;
      }
    })
    .catch(() => {
      const nextUrl = encodeURIComponent("Chatbot.html");
      location.href = `login.html?next=${nextUrl}`;
    });
}

function wireChat() {
  if (!$("#sendBtn")) return;
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
}

function wireAuthForms() {
  // login
  if (/login\.html$/i.test(location.pathname)) {
    const form = $("#loginForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.querySelector('input[name="email"]').value.trim();
        const password = form.querySelector('input[name="password"]').value.trim();
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || "Login error");
        const next = new URLSearchParams(location.search).get("next") || "Chatbot.html";
        location.href = next;
      });
    }
  }

  // register
  if (/register\.html$/i.test(location.pathname)) {
    const form = $("#registerForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const display_name = form.querySelector('input[name="display_name"]').value.trim();
        const email = form.querySelector('input[name="email"]').value.trim();
        const password = form.querySelector('input[name="password"]').value.trim();
        const res = await fetch("/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, display_name }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || "Register error");
        const next = new URLSearchParams(location.search).get("next") || "Chatbot.html";
        location.href = next;
      });
    }
  }
}

function wireProfilePage() {
  if (!/profile\.html$/i.test(location.pathname)) return;

  // yükle
  fetch("/profile")
    .then((r) => {
      if (r.status === 401) location.href = "login.html?next=profile.html";
      return r.json();
    })
    .then((u) => {
      if (!u) return;
      const nameInput = document.querySelector('input[name="display_name"]');
      if (nameInput) nameInput.value = u.display_name || "";
      const img = $("#avatarImg");
      if (img) img.src = u.avatar_url || "/uploads/default-avatar.png";
    });

  // isim kaydet
  const nameForm = $("#nameForm");
  if (nameForm) {
    nameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const display_name = nameForm.querySelector('input[name="display_name"]').value.trim();
      const res = await fetch("/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name }),
      });
      if (!res.ok) return alert("Save error");
      alert("Saved");
    });
  }

  // avatar yükle
  const avatarForm = $("#avatarForm");
  if (avatarForm) {
    avatarForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(avatarForm);
      const res = await fetch("/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Upload error");
      const img = $("#avatarImg");
      if (img) img.src = data.avatar_url;
      alert("Avatar updated!");
    });
  }
}

// ============ boot ============

domReady(() => {
  // Navbar
  setupResponsiveNavbar();
  hydrateNavbar();

  // Header butonları
  safeBind("newChatBtn", cleanupOnNewChat);
  safeBind("logoutBtn", async (e) => {
    e.preventDefault();
    cleanupOnLogout();
    try { await fetch("/logout", { method: "POST" }); } catch {}
    location.href = "login.html";
  });

  // Sidebar sınıf bazlı (id çakışmasın)
  bindAll(".js-newchat", cleanupOnNewChat);
  bindAll(".js-logout", async (e) => {
    e.preventDefault();
    cleanupOnLogout();
    try { await fetch("/logout", { method: "POST" }); } catch {}
    location.href = "login.html";
  });

  // Sayfa özel
  guardChatbotPage();
  wireChat();
  wireAuthForms();
  wireProfilePage();

  // Enter ile gönderme (Genel fallback, chat sayfasında zaten var)
  const input = $("#chat-input");
  if (input && $("#sendBtn")) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#sendBtn").click();
      }
    });
  }
});
