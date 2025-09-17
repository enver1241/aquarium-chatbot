// ============ i18n ============
const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.chatbot': 'Chatbot',
    'nav.feedback': 'Feedback',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.newChat': '+ New Chat',
    'nav.logout': 'Logout',
    'nav.openChat': 'Open Chat',
    'nav.profile': 'Profile',
    
    // Home page
    'home.title': 'Welcome to the Aquarium ChatBot Website',
    'home.subtitle': 'Discover aquatic life, get care tips, and interact with our intelligent bot!',
    'home.goChatbot': 'Go to ChatBot',
    'home.about': 'About us',
    'home.aboutText': 'This website is designed for users who want to learn about aquarium creatures. Users can ask questions through the AI-powered chatbot and get answers instantly. Our project aims to make aquarium maintenance more accessible and fun.',
    
    // Login page
    'login.title': '🔐 Welcome back',
    'login.email': 'Email Address',
    'login.emailPlaceholder': 'Enter your email',
    'login.password': 'Password',
    'login.passwordPlaceholder': 'Enter your password',
    'login.submit': 'Login to Account',
    'login.noAccount': 'No account?',
    'login.createAccount': 'Create one here',
    'login.error.required': 'Username & password required',
    'login.error.network': 'Network error',
    'login.error.failed': 'Login failed',
    
    // Register page
    'register.title': '🎆 Create account',
    'register.displayName': 'Display Name (Optional)',
    'register.displayNamePlaceholder': 'Enter your display name',
    'register.email': 'Email Address',
    'register.emailPlaceholder': 'Enter your email',
    'register.password': 'Password',
    'register.passwordPlaceholder': 'Create a password',
    'register.submit': 'Create Account',
    'register.haveAccount': 'Already have an account?',
    'register.loginHere': 'Login here',
    'register.error.required': 'Username & password required',
    'register.error.network': 'Network error',
    'register.error.failed': 'Registration failed',
    
    // Profile page
    'profile.title': 'My Profile',
    'profile.displayName': 'Display name',
    'profile.displayNamePlaceholder': 'Your name',
    'profile.saveButton': 'Save',
    'profile.avatarLabel': 'Avatar (jpg/png/webp, max 2MB)',
    'profile.avatarPlaceholder': 'Select an image',
    'profile.uploadButton': 'Upload',
    'profile.updateSuccess': 'Profile updated successfully!',
    'profile.updateFailed': 'Failed to update profile',
    'profile.uploadSuccess': 'Avatar uploaded successfully!',
    'profile.uploadFailed': 'Failed to upload avatar',
    'profile.saving': 'Saving...',
    'profile.error.required': 'Display name is required',
    'profile.error.selectFile': 'Please select an image file',
    'profile.error.fileSize': 'File size must be less than 2MB',
    'profile.uploading': 'Uploading...',
    'profile.personalInfo': 'Personal Information',
    'profile.avatar': 'Profile Picture',
    'profile.avatarHelp': 'Recommended size: 200x200 pixels'
  },
  pl: {
    // Navigation
    'nav.home': 'Strona główna',
    'nav.chatbot': 'Chatbot',
    'nav.feedback': 'Opinie',
    'nav.login': 'Zaloguj się',
    'nav.register': 'Zarejestruj się',
    'nav.newChat': '+ Nowa rozmowa',
    'nav.logout': 'Wyloguj się',
    'nav.openChat': 'Otwórz czat',
    'nav.profile': 'Profil',
    
    // Home page
    'home.title': 'Witamy na stronie Aquarium ChatBot',
    'home.subtitle': 'Odkrywaj życie wodne, zdobywaj porady dotyczące pielęgnacji i rozmawiaj z naszym inteligentnym botem!',
    'home.goChatbot': 'Przejdź do ChatBota',
    'home.about': 'O nas',
    'home.aboutText': 'Ta strona jest przeznaczona dla użytkowników, którzy chcą dowiedzieć się więcej o stworzeniach akwariowych. Użytkownicy mogą zadawać pytania za pomocą chatbota wspieranego sztuczną inteligencją i otrzymywać odpowiedzi natychmiast. Nasz projekt ma na celu uczynienie pielęgnacji akwarium bardziej dostępną i przyjemną.',
    
    // Login page
    'login.title': '🔐 Witaj ponownie',
    'login.email': 'Adres email',
    'login.emailPlaceholder': 'Wprowadź swój email',
    'login.password': 'Hasło',
    'login.passwordPlaceholder': 'Wprowadź swoje hasło',
    'login.submit': 'Zaloguj się',
    'login.noAccount': 'Nie masz konta?',
    'login.createAccount': 'Załóż je tutaj',
    'login.error.required': 'Wymagane są nazwa użytkownika i hasło',
    'login.error.network': 'Błąd sieci',
    'login.error.failed': 'Logowanie nieudane',
    
    // Register page
    'register.title': '🎆 Załóż konto',
    'register.displayName': 'Nazwa wyświetlana (opcjonalnie)',
    'register.displayNamePlaceholder': 'Wprowadź swoją nazwę wyświetlaną',
    'register.email': 'Adres email',
    'register.emailPlaceholder': 'Wprowadź swój email',
    'register.password': 'Hasło',
    'register.passwordPlaceholder': 'Utwórz hasło',
    'register.submit': 'Załóż konto',
    'register.haveAccount': 'Masz już konto?',
    'register.loginHere': 'Zaloguj się tutaj',
    'register.error.required': 'Wymagane są nazwa użytkownika i hasło',
    'register.error.network': 'Błąd sieci',
    'register.error.failed': 'Rejestracja nieudana',
    
    // Profile page
    'profile.title': 'Mój Profil',
    'profile.displayName': 'Nazwa wyświetlana',
    'profile.displayNamePlaceholder': 'Twoja nazwa',
    'profile.saveButton': 'Zapisz',
    'profile.avatarLabel': 'Awatar (jpg/png/webp, max 2MB)',
    'profile.avatarPlaceholder': 'Wybierz obraz',
    'profile.uploadButton': 'Prześlij',
    'profile.updateSuccess': 'Profil zaktualizowany pomyślnie!',
    'profile.updateFailed': 'Nie udało się zaktualizować profilu',
    'profile.uploadSuccess': 'Awatar przesłany pomyślnie!',
    'profile.uploadFailed': 'Nie udało się przesłać awatara',
    'profile.saving': 'Zapisywanie...',
    'profile.error.required': 'Wymagana jest nazwa wyświetlana',
    'profile.error.selectFile': 'Wybierz plik obrazu',
    'profile.error.fileSize': 'Rozmiar pliku nie może przekraczać 2MB',
    'profile.uploading': 'Przesyłanie...',
    'profile.personalInfo': 'Dane osobowe',
    'profile.avatar': 'Zdjęcie profilowe',
    'profile.avatarHelp': 'Zalecany rozmiar: 200x200 pikseli'
  }
};

let currentLang = localStorage.getItem('preferredLanguage') || 'en';

function updateContent() {
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (translations[currentLang] && translations[currentLang][key]) {
      element.textContent = translations[currentLang][key];
    } else if (translations['en'][key]) {
      // Fallback to English if translation is missing
      element.textContent = translations['en'][key];
    }
  });

  // Update input placeholders and other attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (translations[currentLang] && translations[currentLang][key]) {
      element.placeholder = translations[currentLang][key];
    } else if (translations['en'][key]) {
      // Fallback to English if translation is missing
      element.placeholder = translations['en'][key];
    }
  });

  // Update HTML lang attribute
  const html = document.documentElement;
  html.setAttribute('lang', currentLang);
  html.setAttribute('data-lang', currentLang);
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'pl' : 'en';
  localStorage.setItem('preferredLanguage', currentLang);
  updateContent();
}

function setupLanguageToggle() {
  const toggleBtn = document.getElementById('langToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleLanguage);
  }
}

// ============ helpers ============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Toast notification system
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = $('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Add to container and set up removal
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
    
    // Auto-remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300); // Wait for fade out
    }, 3000);
  }, 10);
}

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
    img.src = user.avatar_url || "/uploads/default-avatar.svg";
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
      if (img) img.src = u.avatar_url || "/uploads/default-avatar.svg";
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
      const submitBtn = nameForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      
      if (!display_name) {
        alert(translations[currentLang]?.['profile.error.required'] || 'Display name is required');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = translations[currentLang]?.['profile.saving'] || 'Saving...';
        
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ display_name }),
        });
        
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || translations[currentLang]?.['profile.updateFailed'] || 'Failed to update profile', 'error');
          return;
        }
        
        showToast(translations[currentLang]?.['profile.updateSuccess'] || 'Profile updated successfully!', 'success');
        // Update navbar if needed
        hydrateNavbar();
      } catch (e) {
        console.error("Save error:", e);
        showToast(translations[currentLang]?.['profile.updateFailed'] || 'Failed to update profile', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
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
        showToast(translations[currentLang]?.['profile.error.selectFile'] || 'Please select an image file', 'error');
        return;
      }
      
      const file = fileInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        showToast(translations[currentLang]?.['profile.error.fileSize'] || 'File size must be less than 2MB', 'error');
        return;
      }
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      submitBtn.disabled = true;
      submitBtn.textContent = translations[currentLang]?.['profile.uploading'] || 'Uploading...';
      
      try {
        console.log('Starting file upload...');
        const uploadUrl = '/api/upload-avatar';
        
        const response = await fetch(uploadUrl, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        
        console.log('Upload response status:', response.status);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Upload failed');
        }
        
        const result = await response.json();
        console.log('Upload response data:', result);
        
        if (result && result.avatarUrl) {
          // Update the avatar image with cache busting
          const avatarImg = document.getElementById("avatarImg");
          if (avatarImg) {
            const timestamp = Date.now();
            const newUrl = `${result.avatarUrl}${result.avatarUrl.includes('?') ? '&' : '?'}t=${timestamp}`;
            console.log('Updating avatar image source to:', newUrl);
            
            // Update the image source
            avatarImg.src = newUrl;
            
            // Update navbar avatar if it exists
            const navAvatar = document.getElementById("navAvatar");
            if (navAvatar) {
              navAvatar.src = newUrl;
            }
            
            showToast(translations[currentLang]?.['profile.uploadSuccess'] || 'Avatar uploaded successfully!', 'success');
          }
          
          fileInput.value = ''; // Clear file input
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err) {
        console.error('Avatar upload error:', err);
        const errorMessage = err.message || 'Unknown error occurred';
        showToast(`${translations[currentLang]?.['profile.uploadFailed'] || 'Upload failed'}: ${errorMessage}`, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = translations[currentLang]?.['profile.uploadButton'] || 'Upload';
      }
    });
  }
}

// ============ boot ============

domReady(() => {
  // Initialize language system
  setupLanguageToggle();
  updateContent();
  
  // Rest of initialization
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