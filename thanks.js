let countdown = 10;
const el = document.getElementById('countdown');
const t = setInterval(() => {
  countdown--; 
  el.textContent = countdown;
  if (countdown <= 0) { 
    clearInterval(t); 
    window.location.href = '/index.html'; 
  }
}, 1000);
