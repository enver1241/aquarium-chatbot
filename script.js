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
async function sendMessage(text){
  const r = await fetch('/api/chat', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ message: text })
  });
  const data = await r.json();
  addBot((r.ok && data.reply) ? data.reply : 'Error: ' + (data.error || r.statusText));
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

// ============ chat handler ============

async function handleSend() {
  const input = $("#chat-input");
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = "";
  appendMsg("user", text);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: text })
    });

    // Hata durumunda da gövdeyi okumayı dene ki mesajı gösterebilelim
    let data = {};
    try { data = await res.json(); } catch { /* boş bırak */ }

    if (!res.ok) {
      appendMsg("bot", `Bot: ${data.error || res.statusText || "Connection error."}`);
      return;
    }

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

  // Improved mobile touch handling
  let touchStartTime = 0;
  
  btn.addEventListener("touchstart", (e) => {
    touchStartTime = Date.now();
  }, { passive: true });

  btn.addEventListener("touchend", (e) => {
    const touchDuration = Date.now() - touchStartTime;
    if (touchDuration < 300) { // Quick tap
      e.preventDefault();
      e.stopPropagation();
      menu.classList.contains("open") ? closeMenu() : openMenu();
    }
  }, { passive: false });

  btn.addEventListener("click", (e) => {
    // Only handle click if not on touch device or if touch events failed
    if (!('ontouchstart' in window)) {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.contains("open") ? closeMenu() : openMenu();
    }
  });

  // Close menu when clicking links
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });

  // Close with Escape key
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
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        objectFit: "cover",
        marginLeft: "6px",
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
    const resp = await fetch("/api/me");
    const data = await resp.json();
    if (data.user) renderNavUser(data.user);
  } catch { /* sessiz */ }
}

// ============ page-specific ============

function guardChatbotPage() {
  if (!/chatbot\.html$/i.test(location.pathname)) return;
  fetch("/api/me")
    .then((r) => r.json())
    .then((d) => {
      if (!d.user) {
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
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: email, password }),
        });
        let data = {};
        try { data = await res.json(); } catch {}
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
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: email, password }),
        });
        let data = {};
        try { data = await res.json(); } catch {}
        if (!res.ok) return alert(data.error || "Register error");
        const next = new URLSearchParams(location.search).get("next") || "Chatbot.html";
        location.href = next;
      });
    }
  }
}

function wireProfilePage() {
  if (!/profile\.html$/i.test(location.pathname)) return;

  // Load profile data
  fetch("/api/profile", { credentials: "include" })
    .then((r) => {
      if (r.status === 401) {
        location.href = "login.html?next=profile.html";
        return;
      }
      return r.json();
    })
    .then((u) => {
      if (!u) return;
      const nameInput = document.querySelector('input[name="display_name"]');
      if (nameInput) nameInput.value = u.display_name || u.username || "";
      const img = $("#avatarImg");
      if (img) img.src = u.avatar_url || "/uploads/default-avatar.png";
    })
    .catch((e) => {
      console.error("Profile load error:", e);
    });

  // Save display name
  const nameForm = $("#nameForm");
  if (nameForm) {
    nameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const display_name = nameForm.querySelector('input[name="display_name"]').value.trim();
      
      if (!display_name) {
        alert("Please enter a display name");
        return;
      }

      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ display_name }),
        });
        
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Save error");
          return;
        }
        
        alert("Display name saved successfully!");
        // Update navbar if needed
        hydrateNavbar();
      } catch (e) {
        console.error("Save error:", e);
        alert("Network error. Please try again.");
      }
    });
  }

  // Avatar upload
  const avatarForm = $("#avatarForm");
  if (avatarForm) {
    avatarForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const fileInput = avatarForm.querySelector('input[type="file"]');
      const submitBtn = avatarForm.querySelector('button[type="submit"]');
      
      if (!fileInput.files[0]) {
        alert("Please select an image file");
        return;
      }
      
      const file = fileInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      submitBtn.disabled = true;
      submitBtn.textContent = "Uploading...";
      
      try {
        const res = await fetch('/api/profile/avatar', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (res.ok && data.ok) {
          // Update avatar image
          const avatarImg = $("#avatarImg");
          if (avatarImg) {
            avatarImg.src = data.avatar_url + '?t=' + Date.now(); // Cache bust
          }
          
          alert("Avatar updated successfully!");
          fileInput.value = ''; // Clear file input
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (err) {
        console.error('Avatar upload error:', err);
        alert('Upload failed: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Upload";
      }
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
    try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {}
    location.href = "login.html";
  });

  // Sidebar sınıf bazlı (id çakışmasın)
  bindAll(".js-newchat", cleanupOnNewChat);
  bindAll(".js-logout", async (e) => {
    e.preventDefault();
    cleanupOnLogout();
    try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch {}
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