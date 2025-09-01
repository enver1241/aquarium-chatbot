// debug.js — geçici teşhis
console.log("[debug] loaded");

window.addEventListener("DOMContentLoaded", () => {
  console.log("[debug] DOMContentLoaded");

  // 1) Sayfadaki tüm buton ve form submit'leri logla
  document.querySelectorAll("button").forEach((btn, i) => {
    btn.addEventListener("click", (e) => {
      console.log(`[debug] button click #${i}`, btn.innerText.trim() || btn.type || btn.id || btn.name);
    });
  });

  document.querySelectorAll("form").forEach((f, i) => {
    f.addEventListener("submit", () => {
      console.log(`[debug] form submit #${i}`, f.id || f.action || "(no-id)");
    });
  });

  // 2) Görsel bir sayaç: herhangi bir tıklama geliyor mu?
  const badge = document.createElement("div");
  badge.style.cssText = `
    position: fixed; right: 10px; bottom: 10px; z-index: 999999;
    background: #111; color: #0f0; font: 12px/1.2 monospace;
    padding: 6px 8px; border-radius: 6px; opacity: .85; pointer-events: none;
  `;
  badge.textContent = "clicks: 0";
  document.body.appendChild(badge);
  let clicks = 0;
  window.addEventListener("click", () => { badge.textContent = "clicks: " + (++clicks); });

  // 3) Olası 'overlay kaplıyor' durumuna karşı uyarı
  //   En üstte tam ekran bir eleman varsa ve pointer-events kapalı değilse butonları kilitleyebilir.
  const topElem = document.elementFromPoint(innerWidth - 1, innerHeight - 1);
  if (topElem && topElem !== document.body) {
    console.log("[debug] bottom-right element:", topElem.tagName, topElem.className, getComputedStyle(topElem).pointerEvents);
  }

  // 4) script.js gerçekten yüklendi mi?
  console.log("[debug] typeof bindJSONForm =", typeof window.bindJSONForm);
});
