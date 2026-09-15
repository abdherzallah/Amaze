/* ============================================
   DATA HELPERS
   ============================================ */
function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}
function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ============================================
   STATE
   ============================================ */
let cart = getData('amaze_cart', []);
let currentUser = getData('amaze_current_user', null);
let appliedDiscount = null;
try {
  const saved = localStorage.getItem('amaze_discount');
  if (saved) appliedDiscount = JSON.parse(saved);
} catch (e) { appliedDiscount = null; }

/* ============================================
   DOM REFS
   ============================================ */
const cartItemsList    = document.getElementById('cartItemsList');
const itemCount        = document.getElementById('itemCount');
const cartBadge        = document.getElementById('cartBadge');
const subtotalEl       = document.getElementById('subtotal');
const taxEl            = document.getElementById('tax');
const totalEl          = document.getElementById('totalAmount');
const emptyCart        = document.getElementById('emptyCart');
const cartContent      = document.getElementById('cartContent');
const navUserContainer = document.getElementById('navUserContainer');

/* ============================================
   IMAGE PATH NORMALIZER
   ============================================ */
function fixImgPath(img) {
  if (!img) return '';
  return img.replace(/(^|\/)image-video\//, '$1images-video/');
}

/* ============================================
   PHONE NORMALIZER
   ============================================ */
function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-\(\)\.]/g, '');
}

/* ============================================
   TOAST
   ============================================ */
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

/* ============================================
   NAVBAR USER
   ============================================ */
function updateNavbar() {
  currentUser = JSON.parse(localStorage.getItem('amaze_current_user') || 'null');
  if (!navUserContainer) return;

  if (currentUser) {
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    navUserContainer.innerHTML = `
      <div class="nav-user">
        <div class="user-avatar">${initials}</div>
        <span class="user-name">${currentUser.name}</span>
        <a href="javascript:void(0)" class="logout-link" id="navbarLogout"><i class="fas fa-sign-out-alt"></i></a>
      </div>
    `;
    document.getElementById('navbarLogout')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('amaze_current_user');
        window.location.href = 'index.html';
      }
    });
  } else {
    navUserContainer.innerHTML = '';
  }
}

/* ============================================
   RENDER CART
   ============================================ */
function renderCart() {
  if (cart.length === 0) {
    if (emptyCart) emptyCart.style.display = 'block';
    if (cartContent) cartContent.style.display = 'none';
    if (cartBadge) cartBadge.textContent = '0';
    return;
  }

  if (emptyCart) emptyCart.style.display = 'none';
  if (cartContent) cartContent.style.display = 'block';

  const eachText = window.LanguageManager ? LanguageManager.t('cart.each') : 'each';

  let html = '';
  let subtotal = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    const safeImg = fixImgPath(item.img) || 'images-video/amaze.jpeg';

    html += `
      <div class="cart-item" data-index="${index}">
        <div class="item-info">
          <img
            src="${safeImg}"
            alt="${item.name}"
            onerror="this.onerror=null;this.src='images-video/amaze.jpeg'"
          >
          <div class="details">
            <div class="name">${item.name}</div>
            <div class="price">$${item.price.toFixed(2)} ${eachText}</div>
          </div>
        </div>
        <div class="item-actions">
          <div class="qty-control">
            <button onclick="updateQuantity(${index}, -1)">−</button>
            <span>${item.quantity}</span>
            <button onclick="updateQuantity(${index}, 1)">+</button>
          </div>
          <div class="item-total">$${itemTotal.toFixed(2)}</div>
          <button class="btn-remove" onclick="removeItem(${index})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    `;
  });

  cartItemsList.innerHTML = html;

  /* --- Totals with discount --- */
  const discountAmount = appliedDiscount ? Number(appliedDiscount.discount_amount) || 0 : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = discountedSubtotal * 0.08;
  const total = discountedSubtotal + tax;

  /* --- Discount UI row --- */
  const discountRow       = document.getElementById('discountRow');
  const discountValueEl   = document.getElementById('discountValue');
  const discountCodeLabel = document.getElementById('discountCodeLabel');

  if (discountRow && discountValueEl && discountCodeLabel) {
    if (appliedDiscount) {
      discountRow.style.display = 'flex';
      discountValueEl.textContent = '-$' + discountAmount.toFixed(2);
      discountCodeLabel.textContent = appliedDiscount.code;
    } else {
      discountRow.style.display = 'none';
    }
  }

  /* --- Totals display --- */
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const singular = window.LanguageManager ? LanguageManager.t('cartPage.itemSingular') : 'item';
  const plural   = window.LanguageManager ? LanguageManager.t('cartPage.itemPlural')   : 'items';
  if (itemCount) itemCount.textContent = totalItems + ' ' + (totalItems === 1 ? singular : plural);
  if (cartBadge) cartBadge.textContent = totalItems;

  if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
  if (taxEl)      taxEl.textContent      = '$' + tax.toFixed(2);
  if (totalEl)    totalEl.textContent    = '$' + total.toFixed(2);
}

/* ============================================
   CART ACTIONS
   ============================================ */
function updateQuantity(index, change) {
  const item = cart[index];
  if (!item) return;
  const newQty = item.quantity + change;
  if (newQty < 1) return;
  item.quantity = newQty;
  setData('amaze_cart', cart);
  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  setData('amaze_cart', cart);
  renderCart();
  showToast('toast.itemRemoved', 'warning');
}

/* ============================================
   PAYMENT METHOD SELECTION
   ============================================ */
document.querySelectorAll('.payment-method').forEach(method => {
  method.addEventListener('click', function () {
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
    this.classList.add('active');
  });
});

/* ============================================
   FORMATTERS
   ============================================ */
document.getElementById('cardNumber')?.addEventListener('input', function () {
  let value = this.value.replace(/\D/g, '');
  if (value.length > 16) value = value.slice(0, 16);
  let formatted = '';
  for (let i = 0; i < value.length; i++) {
    if (i > 0 && i % 4 === 0) formatted += ' ';
    formatted += value[i];
  }
  this.value = formatted;
});

document.getElementById('expiry')?.addEventListener('input', function () {
  let value = this.value.replace(/\D/g, '');
  if (value.length > 4) value = value.slice(0, 4);
  if (value.length > 2) value = value.slice(0, 2) + '/' + value.slice(2);
  this.value = value;
});

document.getElementById('cvv')?.addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 4);
});

/* ============================================
   DISCOUNT CODE — once per customer (by phone)
   ============================================ */
function validateDiscount(code, subtotal, phone) {
  const discounts = getData('amaze_discounts', []);
  const d = discounts.find(x => x.code.toUpperCase() === code.toUpperCase());

  if (!d) return { ok: false, error: 'Invalid discount code' };
  if (!d.is_active) return { ok: false, error: 'This code is no longer active' };
  if (d.expires_at && new Date(d.expires_at) < new Date()) {
    return { ok: false, error: 'This code has expired' };
  }
  if (d.max_uses && d.uses_count >= d.max_uses) {
    return { ok: false, error: 'This code has reached its usage limit' };
  }

  // Block if this phone has already used this code
  const phoneKey = normalizePhone(phone);
  if (phoneKey && Array.isArray(d.used_by) && d.used_by.includes(phoneKey)) {
    return { ok: false, error: 'You have already used this code' };
  }

  const value = Number(d.discount_value);
  const amount = d.discount_type === 'percent'
    ? Math.round(subtotal * value) / 100
    : Math.min(value, subtotal);

  return {
    ok: true,
    discount: {
      id: d.id,
      code: d.code,
      type: d.discount_type,
      value: value,
      discount_amount: Number(amount.toFixed(2))
    }
  };
}

function applyDiscount() {
  const input = document.getElementById('discountInput');
  const msg   = document.getElementById('discountMsg');
  const code  = (input?.value || '').trim().toUpperCase();
  const phone = document.getElementById('phone')?.value || '';

  if (!code) {
    if (msg) { msg.textContent = 'Please enter a code'; msg.style.color = '#b45f4b'; }
    return;
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const result = validateDiscount(code, subtotal, phone);

  if (!result.ok) {
    if (msg) { msg.textContent = '✗ ' + result.error; msg.style.color = '#b45f4b'; }
    appliedDiscount = null;
    localStorage.removeItem('amaze_discount');
    renderCart();
    return;
  }

  appliedDiscount = result.discount;
  localStorage.setItem('amaze_discount', JSON.stringify(appliedDiscount));

  if (msg) {
    msg.textContent = `✓ Code "${appliedDiscount.code}" applied — you save $${appliedDiscount.discount_amount.toFixed(2)}`;
    msg.style.color = '#2d7d46';
  }
  renderCart();
}

document.getElementById('applyDiscountBtn')?.addEventListener('click', applyDiscount);
document.getElementById('discountInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyDiscount(); }
});

document.getElementById('removeDiscountBtn')?.addEventListener('click', () => {
  appliedDiscount = null;
  localStorage.removeItem('amaze_discount');
  const input = document.getElementById('discountInput');
  const msg   = document.getElementById('discountMsg');
  if (input) input.value = '';
  if (msg)   msg.textContent = '';
  renderCart();
});

/* ============================================
   PLACE ORDER
   ============================================ */
document.getElementById('paymentForm')?.addEventListener('submit', function (e) {
  e.preventDefault();

  const fullName   = document.getElementById('fullName').value.trim();
  const address    = document.getElementById('address').value.trim();
  const city       = document.getElementById('city').value.trim();
  const postalCode = document.getElementById('postalCode').value.trim();
  const country    = document.getElementById('country').value.trim();
  const phone      = document.getElementById('phone').value.trim();
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const expiry     = document.getElementById('expiry').value;
  const cvv        = document.getElementById('cvv').value;

  const errMsg = window.LanguageManager
    ? LanguageManager.t('toast.fillAllFields')
    : 'Please fill in all required fields correctly';

  if (fullName.length < 2)    return showToast(errMsg, 'error');
  if (address.length < 3)     return showToast(errMsg, 'error');
  if (city.length < 2)        return showToast(errMsg, 'error');
  if (postalCode.length < 2)  return showToast(errMsg, 'error');
  if (country.length < 2)     return showToast(errMsg, 'error');
  if (phone.length < 6)       return showToast(errMsg, 'error');
  if (cardNumber.length < 16) return showToast(errMsg, 'error');
  if (expiry.length < 5)      return showToast(errMsg, 'error');
  if (cvv.length < 3)         return showToast(errMsg, 'error');

  /* --- Compute subtotal --- */
  let subtotal = 0;
  cart.forEach(item => { subtotal += item.price * item.quantity; });

  let discountAmount = 0;
  let discountCode   = null;

  /* --- Re-validate discount with the phone the customer just typed --- */
  if (appliedDiscount) {
    const check = validateDiscount(appliedDiscount.code, subtotal, phone);

    if (!check.ok) {
      appliedDiscount = null;
      localStorage.removeItem('amaze_discount');

      if (check.error.toLowerCase().includes('already used')) {
        showToast('❌ You have already used this discount code', 'error');
      } else {
        showToast('❌ ' + check.error, 'error');
      }
      renderCart();
      return;
    }

    discountAmount = check.discount.discount_amount;
    discountCode   = check.discount.code;
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = discountedSubtotal * 0.08;
  const grandTotal = discountedSubtotal + tax;

  const customerName = fullName;
  const orders = getData('amaze_orders', []);

  const order = {
    id: 'AMZ-' + String(orders.length + 1).padStart(3, '0'),
    customer: customerName,
    email: 'guest@example.com',
    fullName, address, city, postalCode, country, phone,
    subtotal: Number(subtotal.toFixed(2)),
    discount_code: discountCode,
    discount_amount: Number(discountAmount.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(grandTotal.toFixed(2)),
    date: new Date().toLocaleDateString(),
    status: 'completed',
    paymentMethod: document.querySelector('.payment-method.active').dataset.method,
    items: cart.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }))
  };

  orders.push(order);
  setData('amaze_orders', orders);

  /* --- Record who used the discount --- */
  if (discountCode) {
    const discounts = getData('amaze_discounts', []);
    const d = discounts.find(x => x.code === discountCode);
    if (d) {
      d.uses_count = (d.uses_count || 0) + 1;
      if (!Array.isArray(d.used_by)) d.used_by = [];
      const phoneKey = normalizePhone(phone);
      if (phoneKey && !d.used_by.includes(phoneKey)) {
        d.used_by.push(phoneKey);
      }
      setData('amaze_discounts', discounts);
    }
  }

  /* --- Update clients --- */
  const clients = getData('amaze_clients', []);
  const existing = clients.find(c => c.name === customerName);
  if (existing) {
    existing.orders = (existing.orders || 0) + 1;
  } else {
    clients.push({
      name: customerName,
      email: 'guest@example.com',
      phone,
      address: address + ', ' + city + ', ' + country,
      orders: 1,
      date: new Date().toLocaleDateString()
    });
  }
  setData('amaze_clients', clients);

  const btn = document.getElementById('placeOrderBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  setTimeout(() => {
    cart = [];
    setData('amaze_cart', cart);
    appliedDiscount = null;
    localStorage.removeItem('amaze_discount');

    document.getElementById('successOrderId').textContent = '#' + order.id;
    document.getElementById('successOverlay').classList.add('active');

    btn.classList.remove('loading');
    btn.disabled = false;
    if (cartBadge) cartBadge.textContent = '0';

    showToast('toast.orderPlaced', 'success');
  }, 1500);
});

/* ============================================
   RE-RENDER ON LANGUAGE CHANGE
   ============================================ */
window.addEventListener('languageChanged', () => {
  renderCart();
});

/* ============================================
   INIT
   ============================================ */
updateNavbar();
renderCart();

if (window.LanguageManager && typeof LanguageManager.init === 'function') {
  LanguageManager.init();
}

/* ============================================
   SECRET ADMIN SHORTCUT
   ============================================ */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    window.location.href = 'admin.html';
  }
});

console.log('✨ AMAZE Cart Page Loaded (per-customer discounts)');