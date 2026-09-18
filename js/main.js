/* ============================================================
   AMAZE · main.js  (for index.html) — backend-aware
   ============================================================ */

let CURRENT_USER     = null;
let CURRENT_COUNTRY  = 'US';
let CURRENT_CURRENCY = 'USD';
let CURRENCY_SYMBOL  = '$';
let cart             = [];
let productQty       = 1;

const PRODUCT = { id: 'serum-01', name: 'Radiant Glow Serum', price: 48.00, img: 'images-video/amaze.jpeg' };

/* ---------- SESSION + CURRENCY ---------- */
async function loadUserSession() {
  try {
    const data = await fetchJson('api/auth_user.php?action=me');
    if (data && data.csrf_token) setCsrfToken(data.csrf_token);
    if (data && data.authenticated) {
      CURRENT_USER    = data.user;
      CURRENT_COUNTRY = data.user.country || 'US';
    }
  } catch (e) {}
  applyCurrency();
}

async function detectCountry() {
  if (CURRENT_USER) return;
  try {
    const data = await fetchJson('api/geo.php');
    if (data && data.ok && data.country) CURRENT_COUNTRY = data.country;
  } catch (e) {}
  applyCurrency();
}

function applyCurrency() {
  CURRENT_CURRENCY = CURRENT_COUNTRY === 'SA' ? 'SAR' : 'USD';
  CURRENCY_SYMBOL  = CURRENT_CURRENCY === 'SAR' ? 'SAR ' : '$';
  window.AMAZE_COUNTRY  = CURRENT_COUNTRY;
  window.AMAZE_CURRENCY = CURRENT_CURRENCY;
  window.AMAZE_SYMBOL   = CURRENCY_SYMBOL;
}

/* ---------- PRODUCT ---------- */
async function loadProductFromApi() {
  try {
    const data = await fetchJson(`api/products.php?country=${CURRENT_COUNTRY}`);
    if (!data.ok || !data.products || !data.products.length) return;
    const p = data.products[0];
    const priceEl = document.querySelector('.product-price');
    if (priceEl) priceEl.innerHTML = `${CURRENCY_SYMBOL}${Number(p.price_display).toFixed(2)}`;
    window.AMAZE_PRODUCT = p;
  } catch (e) { console.error('Product fetch failed:', e); }
}

/* ---------- NAVBAR ---------- */
function updateNavbar() {
  const nav = document.getElementById('navUserContainer');
  if (!nav) return;

  if (CURRENT_USER) {
    const initials = CURRENT_USER.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    nav.innerHTML = `
      <div class="nav-user">
        <div class="user-avatar">${escapeHtml(initials)}</div>
        <span class="user-name">${escapeHtml(CURRENT_USER.name)}</span>
        <a class="logout-link" onclick="logoutUser()" title="Logout"><i class="fas fa-sign-out-alt"></i></a>
      </div>`;
  } else {
    nav.innerHTML = `
      <a href="login.html"><i class="fas fa-sign-in-alt"></i> Login</a>
      <a href="register.html" class="btn-register"><i class="fas fa-user-plus"></i> Register</a>`;
  }
}

async function logoutUser() {
  if (!confirm('Log out?')) return;
  try { await fetchJson('api/auth_user.php?action=logout', { method: 'POST', body: {} }); } catch (e) {}
  window.location.href = 'index.html';
}
window.logoutUser = logoutUser;

/* ---------- TOAST ---------- */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 3500);
}
window.showToast = showToast;

/* ---------- CART ---------- */
function loadCart() {
  try { cart = JSON.parse(localStorage.getItem('amaze_cart') || '[]'); } catch (e) { cart = []; }
  if (!Array.isArray(cart)) cart = [];
  updateCartUI();
}
function saveCart() { localStorage.setItem('amaze_cart', JSON.stringify(cart)); }

function updateCartUI() {
  const badge = document.getElementById('cartBadge');
  const c     = document.getElementById('cartItemsContainer');
  const wrap  = document.getElementById('cartTotalWrapper');
  const price = document.getElementById('cartTotalPrice');
  const count = document.getElementById('cartItemCount');

  const totalItems = cart.reduce((a, i) => a + i.quantity, 0);
  if (badge) badge.textContent = totalItems;
  if (count) count.textContent = totalItems + ' ' + (window.LanguageManager ? LanguageManager.t('cart.items') : 'items');

  if (!c) return;
  const sym = CURRENCY_SYMBOL;

  if (cart.length === 0) {
    c.innerHTML = `<div class="cart-empty"><i class="fas fa-box-open"></i><p>Your cart is empty</p><span>Start your glow journey.</span></div>`;
    if (wrap) wrap.classList.add('hidden');
    return;
  }

  let html = '', total = 0;
  cart.forEach((item, i) => {
    const it = item.price * item.quantity;
    total += it;
    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <img src="${escapeHtml(item.img || 'images-video/amaze.jpeg')}" alt="${escapeHtml(item.name)}"
               onerror="this.onerror=null;this.src='images-video/amaze.jpeg'">
          <div><strong>${escapeHtml(item.name)}</strong> × ${item.quantity}
            <span style="color:#8a7a6e;">${sym}${it.toFixed(2)}</span></div>
        </div>
        <button class="cart-item-remove" data-index="${i}"><i class="fas fa-trash-alt"></i></button>
      </div>`;
  });
  c.innerHTML = html;
  if (wrap) wrap.classList.remove('hidden');
  if (price) price.textContent = sym + total.toFixed(2);

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', function () {
      cart.splice(parseInt(this.dataset.index, 10), 1);
      saveCart(); updateCartUI();
      showToast('Item removed');
    });
  });
}

function addToCart(q) {
  const p = window.AMAZE_PRODUCT;
  const price = p ? Number(p.price_display) : 48.00;
  const id    = p ? p.id : PRODUCT.id;
  const name  = p ? p.name : PRODUCT.name;
  const img   = p ? p.image : PRODUCT.img;
  const ex    = cart.find(i => i.id === id);
  if (ex) ex.quantity += q;
  else cart.push({ id, name, price, img, quantity: q });
  saveCart(); updateCartUI();
  showToast('Added to cart!');
}

/* ---------- REVIEWS ---------- */
async function loadApprovedReviews() {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  const verifiedLabel = window.LanguageManager ? LanguageManager.t('reviews.verified') : 'Verified';

  let reviews = [];
  try {
    const data = await fetchJson('api/reviews.php');
    if (data.ok) reviews = data.reviews || [];
  } catch (e) {}

  if (!reviews.length) { grid.innerHTML = defaultReviewsHtml(verifiedLabel); return; }

  grid.innerHTML = reviews.slice(0, 6).map(r => {
    const rating = Math.max(1, Math.min(5, parseInt(r.rating, 10) || 5));
    const stars  = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    return `
      <div class="review-card glass">
        <div class="review-stars">${stars}</div>
        <p class="review-text">"${escapeHtml(r.text)}"</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3C/svg%3E"
                 alt="${escapeHtml(r.user_name)}">
          </div>
          <div><h4>${escapeHtml(r.user_name)}</h4>
            <span class="review-location"><i class="fas fa-map-pin"></i> ${escapeHtml(r.location || 'Worldwide')}</span></div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>`;
  }).join('');
}

function defaultReviewsHtml(v) {
  const s = [
    { name: 'Sarah Johnson',    loc: 'New York, USA',      text: 'AMAZE is truly amazing! I\'ve struggled with sensitive skin for years, but this makeup remover is so gentle.' },
    { name: 'Jessica Williams', loc: 'Los Angeles, USA',   text: 'I\'ve tried so many makeup removers, but AMAZE is by far the best! So gentle and effective.' },
    { name: 'Noura Al-Fahd',    loc: 'Riyadh, Saudi Arabia', text: 'AMAZE completely transformed my skincare routine! It removes makeup so gently.' }
  ];
  const a = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3C/svg%3E";
  return s.map(r => `
    <div class="review-card glass">
      <div class="review-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
      <p class="review-text">"${escapeHtml(r.text)}"</p>
      <div class="reviewer-info">
        <div class="reviewer-avatar"><img src="${a}" alt="${escapeHtml(r.name)}"></div>
        <div><h4>${escapeHtml(r.name)}</h4><span class="review-location"><i class="fas fa-map-pin"></i> ${escapeHtml(r.loc)}</span></div>
        <span class="review-verified"><i class="fas fa-check-circle"></i> ${v}</span>
      </div>
    </div>`).join('');
}

/* ---------- VIDEO ---------- */
function initBackgroundVideo() {
  const video   = document.getElementById('bgVideo');
  const overlay = document.querySelector('.video-overlay');
  if (!video) return;
  video.muted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.play().catch(() => {});

  const retry = () => { if (video.paused) video.play().catch(() => {}); };
  document.addEventListener('touchstart', retry, { passive: true, once: true });
  document.addEventListener('click', retry, { passive: true, once: true });
  video.addEventListener('error', () => { video.style.display = 'none'; });
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  initBackgroundVideo();
  await loadUserSession();
  await detectCountry();
  await loadProductFromApi();
  updateNavbar();
  loadCart();
  loadApprovedReviews();
  if (window.LanguageManager) LanguageManager.init();

  window.addEventListener('scroll', () => {
    document.querySelector('.navbar-fixed')?.classList.toggle('scrolled', window.scrollY > 40);
  });

  const qtyDisplay = document.getElementById('qtyDisplay');
  document.getElementById('qtyDecrease')?.addEventListener('click', () => {
    if (productQty > 1) { productQty--; qtyDisplay.textContent = productQty; }
  });
  document.getElementById('qtyIncrease')?.addEventListener('click', () => {
    productQty++; qtyDisplay.textContent = productQty;
  });
  document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    const qty = parseInt(qtyDisplay?.textContent, 10) || 1;
    addToCart(qty);
    productQty = 1;
    if (qtyDisplay) qtyDisplay.textContent = '1';
  });
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    if (!cart.length) return;
    if (confirm('Clear your cart?')) {
      cart = []; saveCart(); updateCartUI(); showToast('Cart cleared');
    }
  });
  document.getElementById('cartToggleBtn')?.addEventListener('click', () => {
    window.location.href = 'cart.html';
  });
  document.getElementById('scrollToProduct')?.addEventListener('click', () => scrollToId('productSection'));
  document.getElementById('scrollToProductBtn')?.addEventListener('click', () => scrollToId('productSection'));
  document.getElementById('aboutLink')?.addEventListener('click', (e) => { e.preventDefault(); scrollToId('aboutSection'); });
  document.getElementById('closeProfileModal')?.addEventListener('click', closeAllModals);
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', function (e) { if (e.target === this) closeAllModals(); });
  });
  window.addEventListener('languageChanged', () => { updateCartUI(); loadApprovedReviews(); });
});

function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }
window.closeAllModals = closeAllModals;

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    window.location.href = 'admin-login.html';
  }
});