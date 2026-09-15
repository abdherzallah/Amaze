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

/* ============================================
   DOM REFS
   ============================================ */
const cartItemsList = document.getElementById('cartItemsList');
const itemCount = document.getElementById('itemCount');
const cartBadge = document.getElementById('cartBadge');
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('totalAmount');
const emptyCart = document.getElementById('emptyCart');
const cartContent = document.getElementById('cartContent');
const navUserContainer = document.getElementById('navUserContainer');

/* ============================================
   TOAST (uses translated strings)
   ============================================ */
function showToast(messageOrKey, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // If the string matches a translation key, translate it; otherwise show as-is
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
   NAVBAR USER (only shows if a user logged in earlier)
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

    html += `
      <div class="cart-item" data-index="${index}">
        <div class="item-info">
          <img src="${item.img || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\'%3E%3Crect width=\'64\' height=\'64\' fill=\'%23faf3ef\'/%3E%3Ccircle cx=\'32\' cy=\'32\' r=\'22\' fill=\'%23dbb8ab\'/%3E%3Ccircle cx=\'32\' cy=\'32\' r=\'14\' fill=\'%23b45f4b\' opacity=\'0.3\'/%3E%3C/svg%3E'}" alt="${item.name}">
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

  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const singular = window.LanguageManager ? LanguageManager.t('cartPage.itemSingular') : 'item';
  const plural = window.LanguageManager ? LanguageManager.t('cartPage.itemPlural') : 'items';
  if (itemCount) itemCount.textContent = totalItems + ' ' + (totalItems === 1 ? singular : plural);
  if (cartBadge) cartBadge.textContent = totalItems;

  if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
  if (taxEl) taxEl.textContent = '$' + tax.toFixed(2);
  if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
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
   PLACE ORDER — NO LOGIN REQUIRED
   ============================================ */
document.getElementById('paymentForm')?.addEventListener('submit', function (e) {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const address = document.getElementById('address').value.trim();
  const city = document.getElementById('city').value.trim();
  const postalCode = document.getElementById('postalCode').value.trim();
  const country = document.getElementById('country').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const expiry = document.getElementById('expiry').value;
  const cvv = document.getElementById('cvv').value;

  const errMsg = window.LanguageManager
    ? LanguageManager.t('toast.fillAllFields')
    : 'Please fill in all required fields correctly';

  if (fullName.length < 2) return showToast(errMsg, 'error');
  if (address.length < 3) return showToast(errMsg, 'error');
  if (city.length < 2) return showToast(errMsg, 'error');
  if (postalCode.length < 2) return showToast(errMsg, 'error');
  if (country.length < 2) return showToast(errMsg, 'error');
  if (phone.length < 6) return showToast(errMsg, 'error');
  if (cardNumber.length < 16) return showToast(errMsg, 'error');
  if (expiry.length < 5) return showToast(errMsg, 'error');
  if (cvv.length < 3) return showToast(errMsg, 'error');

  let subtotal = 0;
  cart.forEach(item => { subtotal += item.price * item.quantity; });
  const tax = subtotal * 0.08;
  const grandTotal = subtotal + tax;

  const customerName = fullName;
  const orders = getData('amaze_orders', []);

  const order = {
    id: 'AMZ-' + String(orders.length + 1).padStart(3, '0'),
    customer: customerName,
    email: 'guest@example.com',
    fullName, address, city, postalCode, country, phone,
    total: grandTotal,
    date: new Date().toLocaleDateString(),
    status: 'completed',
    paymentMethod: document.querySelector('.payment-method.active').dataset.method,
    items: cart.map(item => ({ name: item.name, quantity: item.quantity, price: item.price }))
  };

  orders.push(order);
  setData('amaze_orders', orders);

  const clients = getData('amaze_clients', []);
  const existingClient = clients.find(c => c.name === customerName);
  if (existingClient) {
    existingClient.orders = (existingClient.orders || 0) + 1;
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

    document.getElementById('successOrderId').textContent = '#' + order.id;
    document.getElementById('successOverlay').classList.add('active');

    btn.classList.remove('loading');
    btn.disabled = false;
    if (cartBadge) cartBadge.textContent = '0';

    showToast('toast.orderPlaced', 'success');
  }, 1500);
});

/* ============================================
   RE-RENDER CART WHEN LANGUAGE CHANGES
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

console.log('✨ AMAZE Cart Page Loaded (guest checkout enabled)');