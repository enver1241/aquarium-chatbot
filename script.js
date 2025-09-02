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
// --- NAV görünürlüğü ve aktif sayfa işaretleme ---
(function () {
  function showAdminIfLogged() {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    const adminLink = document.getElementById("navAdmin");
    if (adminLink) adminLink.classList.toggle("hidden", !isAdmin);
  }

  function markActiveNav() {
    const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const map = {
      "index.html": "navHome",
      "chatbot.html": "navChatbot",
      "feedback.html": "navFeedback",
      "problem.html": "navProblem",
      "admin.html": "navAdmin",
      "login.html": "navLogin",
      "register.html": "navRegister",
    };
    const id = map[path];
    const el = id && document.getElementById(id);
    if (el) el.style.background = "#eef2ff";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      showAdminIfLogged();
      markActiveNav();
    });
  } else {
    showAdminIfLogged();
    markActiveNav();
  }
})();
// Navbar'da login durumunu yansıt
(function () {
  function renderNav(user) {
    // Login/Register linklerini gizle, profil/çıkış göster; avatarı ekle
    const nav = document.querySelector(".nav-links");
    if (!nav) return;
    // basitçe, zaten olan Login/Register linklerini sakla:
    const login = document.getElementById("navLogin");
    const register = document.getElementById("navRegister");
    if (login) login.style.display = user ? "none" : "";
    if (register) register.style.display = user ? "none" : "";

    // Profil ve Logout ekleri (sayfanda yoksa)
    if (user) {
      let prof = document.getElementById("navProfile");
      if (!prof) {
        prof = document.createElement("a");
        prof.id = "navProfile";
        nav.insertBefore(prof, nav.firstChild.nextSibling);
      }
      prof.href = "profile.html";
      prof.textContent = user.display_name || user.email;

      // Avatar
      let img = document.getElementById("navAvatar");
      if (!img) {
        img = document.createElement("img");
        img.id = "navAvatar";
        img.style.width = "28px";
        img.style.height = "28px";
        img.style.borderRadius = "50%";
        img.style.objectFit = "cover";
        img.style.marginLeft = "6px";
        prof.after(img);
      }
      img.src = user.avatar_url || "/uploads/default-avatar.png";
    }
  }

  fetch("/auth/me").then(r=>r.json()).then(d=>{
    if (d.loggedIn) renderNav(d.user);
  }).catch(()=>{});
})();

// Profil sayfası: bilgileri getir/güncelle
(function () {
  if (!/profile\.html$/i.test(location.pathname)) return;

  // yükle
  fetch("/profile").then(r => {
    if (r.status === 401) location.href = "login.html?next=profile.html";
    return r.json();
  }).then(u => {
    document.querySelector('input[name="display_name"]').value = u.display_name || "";
    document.getElementById("avatarImg").src = u.avatar_url || "/uploads/default-avatar.png";
  });

  // isim kaydet
  document.getElementById("nameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const display_name = e.target.querySelector('input[name="display_name"]').value.trim();
    const res = await fetch("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name })
    });
    if (!res.ok) return alert("Save error");
    alert("Saved");
  });

  // avatar yükle
  document.getElementById("avatarForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const res = await fetch("/profile/avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Upload error");
    document.getElementById("avatarImg").src = data.avatar_url;
  });
})();
// ---- Navbar: login durumu + logout POST ----
(function () {
  function renderNav(user) {
    const login = document.getElementById("navLogin");
    const register = document.getElementById("navRegister");
    if (login) login.style.display = user ? "none" : "";
    if (register) register.style.display = user ? "none" : "";

    const nav = document.querySelector(".nav-links");
    if (!nav) return;

    if (user) {
      let prof = document.getElementById("navProfile");
      if (!prof) {
        prof = document.createElement("a");
        prof.id = "navProfile";
        nav.insertBefore(prof, nav.firstChild.nextSibling);
      }
      prof.href = "profile.html";
      prof.textContent = user.display_name || user.email;

      let img = document.getElementById("navAvatar");
      if (!img) {
        img = document.createElement("img");
        img.id = "navAvatar";
        img.style.width = "28px";
        img.style.height = "28px";
        img.style.borderRadius = "50%";
        img.style.objectFit = "cover";
        img.style.marginLeft = "6px";
        prof.after(img);
      }
      img.src = user.avatar_url || "/uploads/default-avatar.png";
    }
  }

  // Logout (POST)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await fetch("/logout", { method: "POST" }); } catch {}
      location.href = "login.html";
    });
  }

  // Durum çek
  fetch("/auth/me")
    .then(r => r.json())
    .then(d => { if (d.loggedIn) renderNav(d.user); })
    .catch(() => {});
})();

// ---- Chatbot sayfasına guard (ek UX) ----
(function () {
  if (!/chatbot\.html$/i.test(location.pathname)) return;
  fetch("/auth/me")
    .then(r => r.json())
    .then(d => {
      if (!d.loggedIn) {
        const nextUrl = encodeURIComponent("Chatbot.html");
        location.href = `login.html?next=${nextUrl}`;
      }
    })
    .catch(() => {
      const nextUrl = encodeURIComponent("Chatbot.html");
      location.href = `login.html?next=${nextUrl}`;
    });
})();

// ---- Login form ----
(function () {
  if (!/login\.html$/i.test(location.pathname)) return;
  const form = document.getElementById("loginForm");
  if (!form) return;
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
})();

// ---- Register form ----
(function () {
  if (!/register\.html$/i.test(location.pathname)) return;
  const form = document.getElementById("registerForm");
  if (!form) return;
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
})();

// ---- Profile sayfası bağlama ----
(function () {
  if (!/profile\.html$/i.test(location.pathname)) return;

  // yükle
  fetch("/profile").then(r => {
    if (r.status === 401) location.href = "login.html?next=profile.html";
    return r.json();
  }).then(u => {
    const nameInput = document.querySelector('input[name="display_name"]');
    if (nameInput) nameInput.value = u.display_name || "";
    const img = document.getElementById("avatarImg");
    if (img) img.src = u.avatar_url || "/uploads/default-avatar.png";
  });

  // isim kaydet
  const nameForm = document.getElementById("nameForm");
  if (nameForm) nameForm.addEventListener("submit", async (e) => {
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

  // avatar yükle
  const avatarForm = document.getElementById("avatarForm");
  if (avatarForm) avatarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(avatarForm);
    const res = await fetch("/profile/avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Upload error");
    const img = document.getElementById("avatarImg");
    if (img) img.src = data.avatar_url;
  });
})();
// --- Profile sayfası ---
(function () {
  if (!/profile\.html$/i.test(location.pathname)) return;

  // Kullanıcı bilgilerini çek
  fetch("/profile").then(r => {
    if (r.status === 401) {
      location.href = "login.html?next=profile.html";
      return null;
    }
    return r.json();
  }).then(u => {
    if (!u) return;
    const nameInput = document.querySelector('input[name="display_name"]');
    if (nameInput) nameInput.value = u.display_name || "";
    const img = document.getElementById("avatarImg");
    if (img) img.src = u.avatar_url || "/uploads/default-avatar.png";
  });

  // İsim kaydetme
  const nameForm = document.getElementById("nameForm");
  if (nameForm) {
    nameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const display_name = nameForm.querySelector('input[name="display_name"]').value.trim();
      const res = await fetch("/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name }),
      });
      if (!res.ok) {
        alert("Save error");
        return;
      }
      alert("Name updated!");
    });
  }

  // Avatar yükleme
  const avatarForm = document.getElementById("avatarForm");
  if (avatarForm) {
    avatarForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(avatarForm);
      const res = await fetch("/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Upload error");
        return;
      }
      document.getElementById("avatarImg").src = data.avatar_url;
      alert("Avatar updated!");
    });
  }

  // Logout butonu
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await fetch("/logout", { method: "POST" });
      location.href = "login.html";
    });
  }
})();
