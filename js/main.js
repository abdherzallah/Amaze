/* ============================================================
   AMAZE · main.js  (for index.html)
   ============================================================ */

/* ---------- STATE ---------- */
let cart = [];
let currentUser = null;
let productQty = 1;

const PRODUCT = {
  id: 'serum-01',
  name: 'Radiant Glow Serum',
  price: 48.00,
  img: 'images-video/amaze.jpeg'
};

/* ---------- TOAST ---------- */
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

/* ---------- NAVBAR USER ---------- */
function updateNavbar() {
  currentUser = JSON.parse(localStorage.getItem('amaze_current_user') || 'null');
  const navUserContainer = document.getElementById('navUserContainer');
  if (!navUserContainer) return;

  if (currentUser) {
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    navUserContainer.innerHTML = `
      <div class="nav-user">
        <div class="user-avatar">${initials}</div>
        <span class="user-name">${currentUser.name}</span>
        <a class="logout-link" id="navbarLogout"><i class="fas fa-sign-out-alt"></i></a>
      </div>
    `;
    document.getElementById('navbarLogout')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('amaze_current_user');
        location.reload();
      }
    });
  } else {
    navUserContainer.innerHTML = '';
  }
}

/* ---------- CART UI ---------- */
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

  if (cart.length === 0) {
    const emptyText = window.LanguageManager ? LanguageManager.t('cart.empty') : 'Your cart is empty';
    const emptySub = window.LanguageManager ? LanguageManager.t('cart.emptySub') : 'Start your glow journey.';
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
    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <img src="${item.img}" alt="${item.name}">
          <div><strong>${item.name}</strong> × ${item.quantity} <span style="color:#8a7a6e;">$${itemTotal.toFixed(2)}</span></div>
        </div>
        <button class="cart-item-remove" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = html;
  if (cartTotalWrapper) cartTotalWrapper.classList.remove('hidden');
  if (cartTotalPrice) cartTotalPrice.textContent = '$' + total.toFixed(2);

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
  const existing = cart.find(item => item.id === PRODUCT.id);
  if (existing) existing.quantity += quantity;
  else cart.push({ ...PRODUCT, quantity });
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

/* ---------- REVIEWS ---------- */
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
        <div class="review-stars">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
        <p class="review-text">"AMAZE is truly amazing! I've struggled with sensitive skin for years, but this makeup remover is so gentle. It removes everything in one swipe and leaves my skin feeling soft and hydrated."</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%232d2a24'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%232d2a24'/%3E%3Cpath d='M35 50 Q50 58 65 50' stroke='%232d2a24' stroke-width='2' fill='none'/%3E%3C/svg%3E" alt="Sarah" /></div>
          <div><h4>Sarah Johnson</h4><span class="review-location"><i class="fas fa-map-pin"></i> New York, USA</span></div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>
      <div class="review-card glass">
        <div class="review-stars">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
        <p class="review-text">"I've tried so many makeup removers, but AMAZE is by far the best! It's so gentle and effective. I love that I can just use water with it - no harsh chemicals."</p>
        <div class="reviewer-info">
          <div class="reviewer-avatar"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='30' fill='%23dbb8ab'/%3E%3Ccircle cx='35' cy='35' r='4' fill='%232d2a24'/%3E%3Ccircle cx='65' cy='35' r='4' fill='%232d2a24'/%3E%3Cpath d='M40 48 Q50 55 60 48' stroke='%232d2a24' stroke-width='2' fill='none'/%3E%3C/svg%3E" alt="Jessica" /></div>
          <div><h4>Jessica Williams</h4><span class="review-location"><i class="fas fa-map-pin"></i> Los Angeles, USA</span></div>
          <span class="review-verified"><i class="fas fa-check-circle"></i> ${verifiedLabel}</span>
        </div>
      </div>
      <div class="review-card glass">
        <div class="review-stars">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
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

/* ---------- MODALS ---------- */
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}
function openModal(modal) {
  closeAllModals();
  if (modal) modal.classList.add('active');
}

/* ---------- VIDEO AUTOPLAY FIX ---------- */
function initHeroVideo() {
  const video = document.getElementById('bgVideo');
  if (!video) return;

  // Attempt to play (some browsers block until muted is set programmatically)
  video.muted = true;
  video.setAttribute('muted', '');
  const attempt = video.play();
  if (attempt && attempt.catch) {
    attempt.catch((err) => {
      console.warn('Video autoplay blocked:', err.message);
      // Fallback gradient already in CSS via .video-fallback — nothing else needed
    });
  }

  // Handle load errors gracefully
  video.addEventListener('error', () => {
    console.error('Video failed to load. Check that images-video/Amaze.mp4 exists and is H.264-encoded.');
    video.style.display = 'none';
  });

  // Pause when tab is hidden (saves battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else video.play().catch(() => {});
  });
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Video first (so it can start loading ASAP)
  initHeroVideo();

  // Language
  if (window.LanguageManager) LanguageManager.init();

  // Data
  loadCart();
  loadApprovedReviews();
  updateNavbar();

  // Navbar solid on scroll
  window.addEventListener('scroll', () => {
    document.querySelector('.navbar-fixed')?.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Quantity selector
  const qtyDisplay = document.getElementById('qtyDisplay');
  document.getElementById('qtyDecrease')?.addEventListener('click', () => {
    if (productQty > 1) { productQty--; qtyDisplay.textContent = productQty; }
  });
  document.getElementById('qtyIncrease')?.addEventListener('click', () => {
    productQty++; qtyDisplay.textContent = productQty;
  });

  // Add to cart
  document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    const qty = parseInt(qtyDisplay?.textContent, 10) || 1;
    addToCart(qty);
    productQty = 1;
    if (qtyDisplay) qtyDisplay.textContent = '1';
  });

  // Clear cart
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    if (cart.length === 0) return;
    if (confirm('⚠️ Are you sure you want to clear your cart?')) {
      cart = [];
      localStorage.setItem('amaze_cart', JSON.stringify(cart));
      updateCartUI();
      showToast('toast.cartCleared');
    }
  });

  // Cart icon → cart page
  document.getElementById('cartToggleBtn')?.addEventListener('click', () => {
    window.location.href = 'cart.html';
  });

  // Scroll to product
  document.getElementById('scrollToProduct')?.addEventListener('click', () => {
    document.getElementById('productSection')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('scrollToProductBtn')?.addEventListener('click', () => {
    document.getElementById('productSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  // About link scroll
  document.getElementById('aboutLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('aboutSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Close profile modal
  document.getElementById('closeProfileModal')?.addEventListener('click', closeAllModals);
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', function (e) { if (e.target === this) closeAllModals(); });
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('amaze_current_user');
      closeAllModals();
      showToast('toast.loggedOut');
      setTimeout(() => location.reload(), 500);
    }
  });

  // Re-render dynamic content on language change
  window.addEventListener('languageChanged', () => {
    updateCartUI();
    loadApprovedReviews();
  });
});