/* ============================================================
   AMAZE · script.js  (shared utilities — loaded by every page)
   ============================================================ */

/* ---------- Safe HTML escaping ---------- */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

/* ---------- Global CSRF token ---------- */
window.AMAZE_CSRF = '';
function setCsrfToken(token) {
  window.AMAZE_CSRF = token || '';
}
window.setCsrfToken = setCsrfToken;

/* ---------- Fetch JSON helper ---------- */
async function fetchJson(url, options = {}) {
  const opts = Object.assign({
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' }
  }, options);

  const method = (opts.method || 'GET').toUpperCase();
  const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (isWrite && window.AMAZE_CSRF) {
    opts.headers['X-CSRF-Token'] = window.AMAZE_CSRF;
  }

  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }

  if (!res.ok) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
window.fetchJson = fetchJson;

/* ---------- Smooth scroll ---------- */
function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.scrollToId = scrollToId;

/* ---------- Image fallback ---------- */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && !el.dataset.fallbackApplied) {
    el.dataset.fallbackApplied = '1';
    el.src = 'images-video/amaze.jpeg';
  }
}, true);

console.log('✨ AMAZE script.js loaded');