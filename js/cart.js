/* ============================================================
   AMAZE · cart.js — checkout uses the real API
   ============================================================ */

let cart            = [];
let appliedDiscount = null;
let CURRENCY_SYMBOL = '$';

function loadCart() {
  try { cart = JSON.parse(localStorage.getItem('amaze_cart') || '[]'); } catch (e) { cart = []; }
  if (!Array.isArray(cart)) cart = [];
}
function saveCart() { localStorage.setItem('amaze_cart', JSON.stringify(cart)); }

async function loadCurrencyContext() {
  try {
    const data = await fetchJson('api/auth_user.php?action=me');
    if (data && data.csrf_token) setCsrfToken(data.csrf_token);
    if (data && data.authenticated && data.user && data.user.country) {
      CURRENCY_SYMBOL = data.user.country === 'SA' ? 'SAR ' : '$';
      window.AMAZE_COUNTRY = data.user.country;
      return;
    }
  } catch (e) {}
  try {
    const data = await fetchJson('api/geo.php');
    if (data && data.ok && data.country) {
      CURRENCY_SYMBOL = data.country === 'SA' ? 'SAR ' : '$';
      window.AMAZE_COUNTRY = data.country;
    }
  } catch (e) {}
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 3500);
}
window.showToast = showToast;

function renderCart() {
  const sym = CURRENCY_SYMBOL;
  const emptyEl   = document.getElementById('emptyCart');
  const contentEl = document.getElementById('cartContent');

  if (!cart.length) {
    if (emptyEl)   emptyEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';
    const badge = document.getElementById('cartBadge');
    if (badge) badge.textContent = '0';
    return;
  }

  if (emptyEl)   emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';

  const list = document.getElementById('cartItemsList');
  if (!list) return;

  let html = '', subtotal = 0;
  cart.forEach((item, i) => {
    const it = item.price * item.quantity;
    subtotal += it;
    html += `
      <div class="cart-item" data-index="${i}">
        <div class="item-info">
          <img src="${escapeHtml(item.img || 'images-video/amaze.jpeg')}" alt="${escapeHtml(item.name)}"
               onerror="this.onerror=null;this.src='images-video/amaze.jpeg'">
          <div class="details">
            <div class="name">${escapeHtml(item.name)}</div>
            <div class="price">${sym}${item.price.toFixed(2)} each</div>
          </div>
        </div>
        <div class="item-actions">
          <div class="qty-control">
            <button onclick="updateQuantity(${i}, -1)">−</button>
            <span>${item.quantity}</span>
            <button onclick="updateQuantity(${i}, 1)">+</button>
          </div>
          <div class="item-total">${sym}${it.toFixed(2)}</div>
          <button class="btn-remove" onclick="removeItem(${i})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
  });
  list.innerHTML = html;

  const discountAmount = appliedDiscount ? Number(appliedDiscount.discount_amount) || 0 : 0;
  const discounted     = Math.max(0, subtotal - discountAmount);
  const tax            = discounted * 0.08;
  const total          = discounted + tax;

  const dRow = document.getElementById('discountRow');
  const dVal = document.getElementById('discountValue');
  const dLbl = document.getElementById('discountCodeLabel');
  if (dRow && dVal && dLbl) {
    if (appliedDiscount) {
      dRow.style.display = 'flex';
      dVal.textContent = '-' + sym + discountAmount.toFixed(2);
      dLbl.textContent = appliedDiscount.code;
    } else {
      dRow.style.display = 'none';
    }
  }

  const items = cart.reduce((a, i) => a + i.quantity, 0);
  const cEl = document.getElementById('itemCount');
  const bEl = document.getElementById('cartBadge');
  if (cEl) cEl.textContent = items + ' item' + (items === 1 ? '' : 's');
  if (bEl) bEl.textContent = items;

  const sEl = document.getElementById('subtotal');
  const tEl = document.getElementById('tax');
  const gEl = document.getElementById('totalAmount');
  if (sEl) sEl.textContent = sym + subtotal.toFixed(2);
  if (tEl) tEl.textContent = sym + tax.toFixed(2);
  if (gEl) gEl.textContent = sym + total.toFixed(2);
}

function updateQuantity(index, delta) {
  const item = cart[index];
  if (!item) return;
  const q = item.quantity + delta;
  if (q < 1) return;
  item.quantity = q;
  saveCart(); renderCart();
}
window.updateQuantity = updateQuantity;

function removeItem(index) {
  cart.splice(index, 1);
  saveCart(); renderCart();
  showToast('Item removed');
}
window.removeItem = removeItem;

function initPaymentMethods() {
  document.querySelectorAll('.payment-method').forEach(m => {
    m.addEventListener('click', function () {
      document.querySelectorAll('.payment-method').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

async function applyDiscount() {
  const input = document.getElementById('discountInput');
  const msg   = document.getElementById('discountMsg');
  const code  = (input?.value || '').trim().toUpperCase();
  const phone = document.getElementById('phone')?.value || '';

  if (!code) {
    if (msg) { msg.textContent = 'Please enter a code'; msg.style.color = '#b45f4b'; }
    return;
  }

  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const url = `api/discounts.php?code=${encodeURIComponent(code)}&subtotal=${subtotal}&phone=${encodeURIComponent(phone)}`;

  try {
    const data = await fetchJson(url);
    if (!data.ok) {
      appliedDiscount = null;
      localStorage.removeItem('amaze_discount');
      if (msg) { msg.textContent = '✗ ' + data.error; msg.style.color = '#b45f4b'; }
      renderCart();
      return;
    }
    appliedDiscount = {
      code: data.code, type: data.type, value: data.value,
      discount_amount: data.discount_amount
    };
    localStorage.setItem('amaze_discount', JSON.stringify(appliedDiscount));
    if (msg) {
      msg.textContent = `✓ Code "${appliedDiscount.code}" applied — you save ${CURRENCY_SYMBOL}${appliedDiscount.discount_amount.toFixed(2)}`;
      msg.style.color = '#2d7d46';
    }
    renderCart();
  } catch (err) {
    appliedDiscount = null;
    localStorage.removeItem('amaze_discount');
    if (msg) { msg.textContent = '✗ ' + (err.message || 'Could not validate code'); msg.style.color = '#b45f4b'; }
    renderCart();
  }
}

async function placeOrder(e) {
  e.preventDefault();
  const $ = id => document.getElementById(id);
  const payload = {
    full_name:      $('fullName')?.value.trim()    || '',
    address:        $('address')?.value.trim()      || '',
    city:           $('city')?.value.trim()         || '',
    postal_code:    $('postalCode')?.value.trim()   || '',
    country:        $('country')?.value.trim()      || '',
    phone:          $('phone')?.value.trim()        || '',
    payment_method: document.querySelector('.payment-method.active')?.dataset.method || 'visa',
    discount_code:  appliedDiscount ? appliedDiscount.code : null,
    items: cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
  };

  if (payload.full_name.length < 2)   return showToast('Please fill all fields', 'error');
  if (payload.address.length < 3)     return showToast('Please fill all fields', 'error');
  if (payload.city.length < 2)        return showToast('Please fill all fields', 'error');
  if (payload.postal_code.length < 2) return showToast('Please fill all fields', 'error');
  if (payload.country.length < 2)     return showToast('Please fill all fields', 'error');
  if (payload.phone.length < 6)       return showToast('Please fill all fields', 'error');
  if (!cart.length)                   return showToast('Your cart is empty', 'error');

  const btn = document.getElementById('placeOrderBtn');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }

  try {
    const data = await fetchJson('api/orders.php', { method: 'POST', body: payload });
    if (!data.ok) throw new Error(data.error || 'Order failed');

    localStorage.removeItem('amaze_cart');
    localStorage.removeItem('amaze_discount');
    cart = []; appliedDiscount = null;

    const oid = document.getElementById('successOrderId');
    if (oid) oid.textContent = '#' + (data.order.order_code || data.order.id);
    document.getElementById('successOverlay')?.classList.add('active');
    showToast('Order placed successfully!', 'success');
  } catch (err) {
    showToast('✗ ' + (err.message || 'Could not place order'), 'error');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

function initFormatters() {
  document.getElementById('cardNumber')?.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 16);
    this.value = v.replace(/(.{4})/g, '$1 ').trim();
  });
  document.getElementById('expiry')?.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    this.value = v;
  });
  document.getElementById('cvv')?.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 4);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrencyContext();
  loadCart();

  try {
    const saved = localStorage.getItem('amaze_discount');
    if (saved) appliedDiscount = JSON.parse(saved);
  } catch (e) { appliedDiscount = null; }

  renderCart();
  initPaymentMethods();
  initFormatters();

  if (window.LanguageManager) LanguageManager.init();

  document.getElementById('applyDiscountBtn')?.addEventListener('click', applyDiscount);
  document.getElementById('discountInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyDiscount(); }
  });
  document.getElementById('removeDiscountBtn')?.addEventListener('click', () => {
    appliedDiscount = null;
    localStorage.removeItem('amaze_discount');
    const i = document.getElementById('discountInput');
    const m = document.getElementById('discountMsg');
    if (i) i.value = '';
    if (m) m.textContent = '';
    renderCart();
  });
  document.getElementById('paymentForm')?.addEventListener('submit', placeOrder);
  window.addEventListener('languageChanged', renderCart);
});

console.log('✨ AMAZE cart.js loaded');