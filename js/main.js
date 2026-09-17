/* ============================================================
   AMAZE · main.js  (for index.html)
   ============================================================ */

/* ============================================================
   USER SESSION + COUNTRY + CURRENCY
   ============================================================ */
let CURRENT_USER     = null;
let CURRENT_COUNTRY  = 'US';
let CURRENT_CURRENCY = 'USD';
let CURRENCY_SYMBOL  = '$';

async function loadUserSession() {
  try {
    const res = await fetch('api/auth_user.php?action=me', { credentials: 'same-origin' });
    const data = await res.json();
    if (data.authenticated) {
      CURRENT_USER = data.user;
      CURRENT_COUNTRY = data.user.country || 'US';
    }
  } catch (e) {}

  CURRENT_CURRENCY = CURRENT_COUNTRY === 'SA' ? 'SAR' : 'USD';
  CURRENCY_SYMBOL  = CURRENT_CURRENCY === 'SAR' ? 'SAR ' : '$';

  window.AMAZE_COUNTRY  = CURRENT_COUNTRY;
  window.AMAZE_CURRENCY = CURRENT_CURRENCY;
  window.AMAZE_SYMBOL   = CURRENCY_SYMBOL;
}

async function detectCountry() {
  if (CURRENT_USER) return;
  try {
    const res = await fetch('api/geo.php', { credentials: 'same-origin' });
    const data = await res.json();
    if (data.ok && data.country) {
      CURRENT_COUNTRY  = data.country;
      CURRENT_CURRENCY = CURRENT_COUNTRY === 'SA' ? 'SAR' : 'USD';
      CURRENCY_SYMBOL  = CURRENT_CURRENCY === 'SAR' ? 'SAR ' : '$';

      window.AMAZE_COUNTRY  = CURRENT_COUNTRY;
      window.AMAZE_CURRENCY = CURRENT_CURRENCY;
      window.AMAZE_SYMBOL   = CURRENCY_SYMBOL;
    }
  } catch (e) {}
}

async function loadProductFromApi() {
  try {
    const res = await fetch(`api/products.php?country=${CURRENT_COUNTRY}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok || !data.products || !data.products.length) return;

    const p = data.products[0];
    const sym = CURRENCY_SYMBOL;

    const priceEl = document.querySelector('.product-price');
    if (priceEl) {
      priceEl.innerHTML = `${sym}${Number(p.price_display).toFixed(2)}`;
    }

    window.AMAZE_PRODUCT = p;

    try {
      localStorage.setItem('amaze_product', JSON.stringify({
        id: p.id,
        name: p.name,
        image: p.image,
        price_display: p.price_display,
        bundle_qty: p.bundle_qty,
        bundle_price: p.bundle_price,
        currency: p.currency,
        country: CURRENT_COUNTRY
      }));
    } catch (e) {}
  } catch (e) {
    console.error('Product fetch failed:', e);
  }
}

function updateNavbar() {
  const navUserContainer = document.getElementById('navUserContainer');
  if (!navUserContainer) return;

  if (CURRENT_USER) {
    const initials = CURRENT_USER.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    navUserContainer.innerHTML = `
      <div class="nav-user">
        <div class="user-avatar">${initials}</div>
        <span class="user-name">${CURRENT_USER.name}</span>
        <a class="logout-link" onclick="logoutUser()"><i class="fas fa-sign-out-alt"></i></a>
      </div>
    `;
  } else {
    navUserContainer.innerHTML = `
      <a href="login.html"><i class="fas fa-sign-in-alt"></i> Login</a>
      <a href="register.html" class="btn-register"><i class="fas fa-user-plus"></i> Register</a>
    `;
  }
}

async function logoutUser() {
  if (!confirm('Log out?')) return;
  try {
    await fetch('api/auth_user.php?action=logout', { method: 'POST', credentials: 'same-origin' });
  } catch (e) {}
  window.location.href = 'index.html';
}
window.logoutUser = logoutUser;

/* ============================================================
   STATE
   ============================================================ */
let cart = [];
let productQty = 1;

const PRODUCT = {
  id: 'serum-01',
  name: 'Radiant Glow Serum',
  price: 48.00,
  img: 'images-video/amaze.jpeg'
};

function fixImgPath(img) {
  if (!img) return '';
  return img.replace(/(^|\/)image-video\//, '$1images-video/');
}

function showToast(messageOrKey, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  let msg = messageOrKey;
  if (window.LanguageManager && typeof messageOrKey === 'string') {
    const translated = LanguageManager.t(messageOrKey);
    if (translated !== messageOrKey) msg = translated;
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ============================================================
   CART UI
   ============================================================ */
function updateCartUI() {
  const cartBadge = document.getElementById('cartBadge');
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const cartTotalWrapper = document.getElementById('cartTotalWrapper');
  const cartTotalPrice = document.getElementById('cartTotalPrice');
  const cartItemCount = document.getElementById('cartItemCount');

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  if (cartBadge) cartBadge.textContent = totalItems;

  const itemsLabel = window.LanguageManager ? LanguageManager.t('cart.items') : 'items';
  if (cartItemCount) cartItemCount.textContent = totalItems + ' ' + itemsLabel;

  if (!cartItemsContainer) return;

  const sym = window.AMAZE_SYMBOL || '$';

  if (cart.length === 0) {
    const emptyText = window.LanguageManager ? LanguageManager.t('cart.empty') : 'Your cart is empty';
    const emptySub  = window.LanguageManager ? LanguageManager.t('cart.emptySub') : 'Start your glow journey.';
    cartItemsContainer.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-box-open"></i>
        <p>${emptyText}</p>
        <span>${emptySub}</span>
      </div>
    `;
    if (cartTotalWrapper) cartTotalWrapper.classList.add('hidden');
    return;
  }

  let html = '';
  let total = 0;
  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    const safeImg = fixImgPath(item.img) || 'images-video/amaze.jpeg';

    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <img src="${safeImg}" alt="${item.name}" onerror="this.onerror=null;this.src='images-video/amaze.jpeg'">
          <div><strong>${item.name}</strong> × ${item.quantity} <span style="color:#8a7a6e;">${sym}${itemTotal.toFixed(2)}</span></div>
        </div>
        <button class="cart-item-remove" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = html;
  if (cartTotalWrapper) cartTotalWrapper.classList.remove('hidden');
  if (cartTotalPrice) cartTotalPrice.textContent = sym + total.toFixed(2);

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', function () {
      const idx = parseInt(this.dataset.index, 10);
      cart.splice(idx, 1);
      localStorage.setItem('amaze_cart', JSON.stringify(cart));
      updateCartUI();
      showToast('toast.itemRemoved', 'warning');
    });
  });
}

function addToCart(quantity) {
  const product = window.AMAZE_PRODUCT;
  const price = product ? Number(product.price_display) : 48.00;
  const id    = product ? product.id : PRODUCT.id;
  const name  = product ? product.name : PRODUCT.name;
  const img   = product ? product.image : PRODUCT.img;

  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ id, name, price, img, quantity });
  }

  localStorage.setItem('amaze_cart', JSON.stringify(cart));
  updateCartUI();
  showToast('toast.addedToCart');
}

function loadCart() {
  const savedCart = localStorage.getItem('amaze_cart');
  if (savedCart) {
    try { cart = JSON.parse(savedCart); } catch (e) { cart = []; }
  }
  updateCartUI();
}

/* ============================================================
   REVIEWS
   ============================================================ */
function loadApprovedReviews() {
  const reviews = JSON.parse(localStorage.getItem('amaze_reviews') || '[]');
  const approved = reviews.filter(r => r.status === 'approved');
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;

  const verifiedLabel = window.LanguageManager
    ? LanguageManager.t('reviews.verified')
    : 'Verified';

  if (approved.length === 0) {
    grid.innerHTML = `
      <div class="review-card glass">
        <div class="review-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
        <p class="review-text">"AMAZE is truly amazing! I've struggled with sensitive skin for years, but this makeup remover is so gentle. It removes everything in one swipe and leaves my skin feeling soft and hydrated."</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%232d2a24'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%232d2a24'/%3E%3Cpath d='M35 50 Q50 58 65 50' stroke='%232d2a24' stroke-width='2' fill='none'/%3E%3C/svg%3E" alt="Sarah" /></div>
          <div><h4>Sarah Johnson</h4><span class="review-location"><i class="fas fa-map-pin"></i> New York, USA</span></div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>
      <div class="review-card glass">
        <div class="review-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
        <p class="review-text">"I've tried so many makeup removers, but AMAZE is by far the best! It's so gentle and effective. I love that I can just use water with it - no harsh chemicals."</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%232d2a24'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%232d2a24'/%3E%3Cpath d='M40 48 Q50 55 60 48' stroke='%232d2a24' stroke-width='2' fill='none'/%3E%3C/svg%3E" alt="Jessica" /></div>
          <div><h4>Jessica Williams</h4><span class="review-location"><i class="fas fa-map-pin"></i> Los Angeles, USA</span></div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>
      <div class="review-card glass">
        <div class="review-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
        <p class="review-text">"AMAZE completely transformed my skincare routine! It removes makeup so gently and doesn't irritate my sensitive skin at all. I highly recommend it to anyone looking for a natural and effective product!"</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%232d2a24'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%232d2a24'/%3E%3Cpath d='M38 52 Q50 60 62 52' stroke='%232d2a24' stroke-width='2' fill='none'/%3E%3C/svg%3E" alt="Noura" /></div>
          <div><h4>Noura Al-Fahd</h4><span class="review-location"><i class="fas fa-map-pin"></i> Riyadh, Saudi Arabia</span></div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>
    `;
    return;
  }

  let html = '';
  approved.slice().reverse().forEach(review => {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    html += `
      <div class="review-card glass">
        <div class="review-stars">${stars}</div>
        <p class="review-text">"${review.text}"</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%232d2a24'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%232d2a24'/%3E%3Cpath d='M35 50 Q50 58 65 50' stroke='%232d2a24' stroke-width='2' fill='none'/%3E%3C/svg%3E" alt="${review.userName}" />
          </div>
          <div>
            <h4>${review.userName}</h4>
            <span class="review-location"><i class="fas fa-map-pin"></i> ${review.location || 'Worldwide'}</span>
          </div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

/* ---------- Modals ---------- */
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}
function openModal(modal) {
  closeAllModals();
  if (modal) modal.classList.add('active');
}

/* ============================================================
   BACKGROUND VIDEO — plays continuously behind everything.
   It fades subtly as the user scrolls down so text remains
   readable over the content sections.
   ============================================================ */
function initBackgroundVideo() {
  const video   = document.getElementById('bgVideo');
  const overlay = document.querySelector('.video-overlay');
  if (!video) return;

  video.muted = true;
  video.setAttribute('muted', '');
  const attempt = video.play();
  if (attempt && attempt.catch) {
    attempt.catch((err) => console.warn('Video autoplay blocked:', err.message));
  }

  video.addEventListener('error', () => {
    console.error('Video failed to load. Check images-video/Amaze1.mp4 exists.');
    video.style.display = 'none';
  });

  video.addEventListener('loadedmetadata', () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      console.log('🎥 Video: ' + video.videoWidth + '×' + video.videoHeight +
                  ' (' + Math.round(video.duration) + 's)');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else video.play().catch(() => {});
  });

  /* Subtle parallax: video stays fixed but shifts slightly */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      const progress = Math.min(scrollY / vh, 3);

      /* Video drifts up slightly (parallax feel) */
      video.style.transform = `translate(-50%, calc(-50% + ${scrollY * 0.15}px))`;

      /* Overlay dims more as you scroll deeper (for readability) */
      if (overlay) {
        const dim = Math.min(0.45 + progress * 0.1, 0.75);
        overlay.style.background =
          `linear-gradient(to bottom,
            rgba(25, 15, 12, ${dim}) 0%,
            rgba(25, 15, 12, ${dim + 0.1}) 50%,
            rgba(25, 15, 12, ${Math.min(dim + 0.2, 0.85)}) 100%)`;
      }

      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initBackgroundVideo();

  await loadUserSession();
  await detectCountry();
  await loadProductFromApi();

  updateNavbar();

  if (window.LanguageManager) LanguageManager.init();

  loadCart();
  loadApprovedReviews();

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
    if (cart.length === 0) return;
    if (confirm('⚠️ Are you sure you want to clear your cart?')) {
      cart = [];
      localStorage.setItem('amaze_cart', JSON.stringify(cart));
      updateCartUI();
      showToast('toast.cartCleared');
    }
  });

  document.getElementById('cartToggleBtn')?.addEventListener('click', () => {
    window.location.href = 'cart.html';
  });

  document.getElementById('scrollToProduct')?.addEventListener('click', () => {
    document.getElementById('productSection')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('scrollToProductBtn')?.addEventListener('click', () => {
    document.getElementById('productSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('aboutLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('aboutSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('closeProfileModal')?.addEventListener('click', closeAllModals);
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', function (e) { if (e.target === this) closeAllModals(); });
  });

  window.addEventListener('languageChanged', () => {
    updateCartUI();
    loadApprovedReviews();
  });
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    window.location.href = 'admin-login.html';
  }
});