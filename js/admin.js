/* ============================================================
   AMAZE · admin.js — full dashboard logic
   ============================================================ */

/* ---------- HELPERS ---------- */
function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}
function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ---------- LOGOUT ---------- */
function adminLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  sessionStorage.removeItem('amaze_admin_ok');
  window.location.href = 'index.html';
}
window.adminLogout = adminLogout;

/* ---------- STATE ---------- */
let orders    = getData('amaze_orders', []);
let inventory = getData('amaze_inventory', []);
let reviews   = getData('amaze_reviews', []);
let discounts = getData('amaze_discounts', []);

/* ============================================================
   DASHBOARD
   ============================================================ */
function updateDashboard() {
  const totalOrders   = orders.length;
  const totalProducts = inventory.length;

  const totalOrdersEl   = document.getElementById('totalOrders');
  const totalProductsEl = document.getElementById('totalProducts');
  const orderBadgeEl    = document.getElementById('orderBadge');
  const reviewBadgeEl   = document.getElementById('reviewBadge');

  if (totalOrdersEl)   totalOrdersEl.textContent = totalOrders;
  if (totalProductsEl) totalProductsEl.textContent = totalProducts;
  if (orderBadgeEl)    orderBadgeEl.textContent = totalOrders;
  if (reviewBadgeEl)   reviewBadgeEl.textContent = getPendingReviews().length;

  const lastMonthOrders = orders.filter(o => {
    const date = new Date(o.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() - 1 ||
           (date.getMonth() === 11 && now.getMonth() === 0);
  }).length;

  const ordersChange = totalOrders > 0
    ? Math.round((totalOrders - lastMonthOrders) / (lastMonthOrders || 1) * 100)
    : 0;

  const changeEl = document.getElementById('ordersChange');
  if (changeEl) {
    changeEl.textContent = (ordersChange >= 0 ? '↑ ' : '↓ ') + Math.abs(ordersChange) + '% this month';
    changeEl.className = 'stat-change ' + (ordersChange >= 0 ? 'up' : 'down');
  }

  const productsChangeEl = document.getElementById('productsChange');
  if (productsChangeEl) productsChangeEl.textContent = totalProducts + ' total';

  updateOrdersList();
  updateInventory();
  updateStockAlerts();
  updateReviewsList();
  renderDiscounts();
}

/* ============================================================
   ORDERS
   ============================================================ */
function updateOrdersList() {
  const container = document.getElementById('ordersContainer');
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>No orders yet</p>
        <span>Orders will appear here when customers purchase</span>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  orders.slice().reverse().forEach((order, index) => {
    const statusClass = order.status || 'completed';
    const statusText = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
    const statusIcon = statusClass === 'completed' ? '✓' :
                       statusClass === 'shipped'   ? '🚚' :
                       statusClass === 'pending'   ? '⏳' : '✗';

    html += `
      <tr>
        <td><strong>#${order.id || 'AMZ-' + String(index + 1).padStart(3, '0')}</strong></td>
        <td>${order.customer || 'Guest'}</td>
        <td>${order.date || new Date().toLocaleDateString()}</td>
        <td>$${Number(order.total || 0).toFixed(2)}</td>
        <td><span class="status ${statusClass}">${statusIcon} ${statusText}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/* ============================================================
   INVENTORY
   ============================================================ */
function updateInventory() {
  const grid = document.getElementById('inventoryGrid');
  if (!grid) return;

  if (inventory.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <i class="fas fa-box-open"></i>
        <p>No products in inventory</p>
        <span>Click "Add Product" to get started</span>
      </div>
    `;
    return;
  }

  let html = '';
  inventory.forEach((item, index) => {
    const stockPercent = Math.min((item.stock / 200) * 100, 100);
    const stockColor = item.stock < 20 ? '#b45f4b' : item.stock < 50 ? '#f39c12' : '#2d7d46';
    const stockDisplay = item.stock === 0 ? 'Out of Stock' : item.stock + ' units';

    html += `
      <div class="inventory-item">
        <div class="item-name"><i class="fas ${item.icon || 'fa-box'}"></i> ${item.name}</div>
        <div class="item-sku">SKU: ${item.sku}</div>
        <div class="item-stock">
          <span style="font-weight:600; color:${item.stock === 0 ? '#b45f4b' : stockColor};">
            ${stockDisplay}
          </span>
          <div class="stock-bar">
            <div class="fill" style="width:${stockPercent}%; background:${item.stock === 0 ? '#b45f4b' : stockColor};"></div>
          </div>
        </div>
        <div class="stock-actions">
          <input type="number" id="stockInput_${index}" min="0" value="10" />
          <button class="btn-restock" onclick="restockItem(${index})">+ Add</button>
          <button class="btn-restock-small" onclick="quickRestock(${index}, 50)">+50</button>
          <button class="btn-restock-small" onclick="quickRestock(${index}, 100)">+100</button>
          <button class="btn-set-zero" onclick="setStockToZero(${index})">Set 0</button>
          <button class="btn-delete" onclick="deleteProduct(${index})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

function restockItem(index) {
  const input = document.getElementById('stockInput_' + index);
  const amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount < 0) return showToast('Enter a valid number', 'error');

  const item = inventory[index];
  if (item) {
    item.stock += amount;
    setData('amaze_inventory', inventory);
    updateDashboard();
    showToast('✅ Added ' + amount + ' units to ' + item.name);
  }
}
function quickRestock(index, amount) {
  const item = inventory[index];
  if (item) {
    item.stock += amount;
    setData('amaze_inventory', inventory);
    updateDashboard();
    showToast('✅ Added ' + amount + ' units to ' + item.name);
  }
}
function setStockToZero(index) {
  const item = inventory[index];
  if (item && confirm('⚠️ Set stock of "' + item.name + '" to 0?')) {
    item.stock = 0;
    setData('amaze_inventory', inventory);
    updateDashboard();
    showToast('🔄 Stock set to 0');
  }
}
function deleteProduct(index) {
  const item = inventory[index];
  if (confirm('⚠️ Delete "' + item.name + '"?')) {
    inventory.splice(index, 1);
    setData('amaze_inventory', inventory);
    updateDashboard();
    showToast('🗑️ Deleted');
  }
}

/* ============================================================
   STOCK ALERTS
   ============================================================ */
function updateStockAlerts() {
  const container  = document.getElementById('stockAlertsContainer');
  const alertText  = document.getElementById('stockAlertText');
  const stockBadge = document.getElementById('stockBadge');
  if (!container) return;

  const lowStock = inventory.filter(i => i.stock < 20);
  if (stockBadge) stockBadge.textContent = lowStock.length;

  if (lowStock.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color:#2d7d46;"></i>
        <p>All items are well stocked</p>
        <span>No alerts at this time</span>
      </div>
    `;
    if (alertText) {
      alertText.textContent = '✅ All items in stock';
      alertText.style.color = '#2d7d46';
    }
    return;
  }

  if (alertText) {
    alertText.textContent = '⚠️ ' + lowStock.length + ' item' + (lowStock.length > 1 ? 's' : '') + ' need restock';
    alertText.style.color = '#b45f4b';
  }

  let html = '';
  lowStock.forEach((item) => {
    const color = item.stock < 10 ? '#b45f4b' : '#f39c12';
    const actualIndex = inventory.indexOf(item);
    const stockDisplay = item.stock === 0 ? 'Out of Stock' : item.stock + ' left';
    html += `
      <div class="stock-alert-item">
        <div class="alert-info">
          <div class="name">${item.name}</div>
          <div class="sku">SKU: ${item.sku}</div>
        </div>
        <div class="alert-actions">
          <span class="qty-badge" style="color:${color};">${stockDisplay}</span>
          <button class="btn-alert-restock" onclick="quickRestock(${actualIndex}, 100)">+100</button>
          <button class="btn-alert-zero" onclick="setStockToZero(${actualIndex})">Set 0</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

/* ============================================================
   REVIEWS
   ============================================================ */
function getPendingReviews() { return reviews.filter(r => r.status === 'pending'); }

function updateReviewsList() {
  const container = document.getElementById('reviewsContainer');
  const countText = document.getElementById('reviewCountText');
  if (!container) return;

  const pending = getPendingReviews();
  if (countText) countText.textContent = pending.length + ' pending review' + (pending.length !== 1 ? 's' : '');
  const badge = document.getElementById('reviewBadge');
  if (badge) badge.textContent = pending.length;

  if (pending.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-star"></i>
        <p>No reviews pending</p>
        <span>All reviews have been processed</span>
      </div>
    `;
    return;
  }

  let html = '';
  pending.slice().reverse().forEach((review) => {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    html += `
      <div class="review-item">
        <div class="review-header">
          <div>
            <span class="review-stars">${stars}</span>
            <span class="review-user">${review.userName}</span>
          </div>
          <span class="review-status pending">Pending</span>
        </div>
        <div class="review-text">"${review.text}"</div>
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
          <span class="review-date">${review.date || ''}</span>
          <span style="font-size:11px; color:#8a7a6e;">${review.id || ''}</span>
        </div>
        <div class="review-actions">
          <button class="btn-approve" onclick="approveReview('${review.id}')"><i class="fas fa-check"></i> Approve</button>
          <button class="btn-reject" onclick="rejectReview('${review.id}')"><i class="fas fa-times"></i> Reject</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function approveReview(id) {
  const r = reviews.find(x => x.id === id);
  if (r) { r.status = 'approved'; setData('amaze_reviews', reviews); updateDashboard(); showToast('✅ Approved'); }
}
function rejectReview(id) {
  const r = reviews.find(x => x.id === id);
  if (r) { r.status = 'rejected'; setData('amaze_reviews', reviews); updateDashboard(); showToast('❌ Rejected'); }
}

/* ============================================================
   PRODUCTS
   ============================================================ */
function addProduct() {
  const name = prompt('Product name:');
  if (!name || !name.trim()) return;
  const sku = prompt('SKU (e.g. AMZ-002):');
  if (!sku || !sku.trim()) return;
  const stock = parseInt(prompt('Initial stock (default 0):') || '0', 10);

  inventory.push({
    name: name.trim(),
    sku: sku.trim().toUpperCase(),
    stock: stock || 0,
    icon: 'fa-box'
  });
  setData('amaze_inventory', inventory);
  updateDashboard();
  showToast('✅ Product added');
}

function clearAllOrders() {
  if (orders.length === 0) return;
  if (confirm('⚠️ Clear all orders?')) {
    orders = [];
    setData('amaze_orders', orders);
    updateDashboard();
    showToast('✅ All orders cleared');
  }
}

/* ============================================================
   DISCOUNTS
   ============================================================ */
function renderDiscounts() {
  const container = document.getElementById('discountsContainer');
  if (!container) return;

  if (discounts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-tags"></i>
        <p>No discount codes yet</p>
        <span>Click "+ New Code" to create your first one</span>
      </div>
    `;
    return;
  }

  const now = new Date();
  let html = '<div class="discounts-grid">';

  discounts.slice().reverse().forEach((d) => {
    const expired    = d.expires_at && new Date(d.expires_at) < now;
    const reachedMax = d.max_uses && d.uses_count >= d.max_uses;
    const isInactive = !d.is_active || expired || reachedMax;
    const uniqueUsers = Array.isArray(d.used_by) ? d.used_by.length : 0;

    const valueDisplay = d.discount_type === 'percent'
      ? `${d.discount_value}<small>% off</small>`
      : `$${Number(d.discount_value).toFixed(2)}<small>off</small>`;

    html += `
      <div class="discount-card ${isInactive ? 'inactive' : ''}">
        <div class="dc-head">
          <span class="dc-code">${d.code}</span>
          <span class="dc-status ${isInactive ? 'off' : 'on'}">
            ${isInactive ? (expired ? 'Expired' : reachedMax ? 'Used Up' : 'Inactive') : 'Active'}
          </span>
        </div>
        <div class="dc-value">${valueDisplay}</div>
        <div class="dc-meta">
          <div><i class="fas fa-redo"></i> Used: ${d.uses_count || 0}${d.max_uses ? ' / ' + d.max_uses : ' / ∞'}</div>
          ${uniqueUsers ? `<div><i class="fas fa-users"></i> ${uniqueUsers} unique customer${uniqueUsers > 1 ? 's' : ''}</div>` : ''}
          <div><i class="fas fa-calendar"></i> ${d.expires_at ? 'Expires ' + d.expires_at : 'Never expires'}</div>
        </div>
        <div class="dc-actions">
          <button class="btn-toggle" onclick="toggleDiscount('${d.id}')">
            <i class="fas fa-power-off"></i> ${d.is_active ? 'Disable' : 'Enable'}
          </button>
          <button class="btn-copy" onclick="copyDiscount('${d.code}')">
            <i class="fas fa-copy"></i> Copy
          </button>
          <button class="btn-delete" onclick="deleteDiscount('${d.id}')" title="Delete">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

/* ---------- Modal ---------- */
function openDiscountModal() {
  document.getElementById('dcCode').value = '';
  document.getElementById('dcType').value = 'percent';
  document.getElementById('dcValue').value = '';
  document.getElementById('dcMaxUses').value = '';
  document.getElementById('dcExpires').value = '';
  document.getElementById('dcActive').checked = true;
  document.getElementById('dcValueSuffix').textContent = '%';
  document.getElementById('dcValue').placeholder = '20';
  document.getElementById('dcValue').max = 100;

  updateDiscountPreview();

  document.getElementById('discountModal').classList.add('active');

  setTimeout(() => document.getElementById('dcCode')?.focus(), 200);
}

function closeDiscountModal() {
  document.getElementById('discountModal').classList.remove('active');
}

/* ---------- Type change ---------- */
function setDiscountType(type) {
  document.getElementById('dcType').value = type;
  const suffix = document.getElementById('dcValueSuffix');
  const input  = document.getElementById('dcValue');
  if (type === 'percent') {
    if (suffix) suffix.textContent = '%';
    if (input) { input.max = 100; input.placeholder = '20'; }
  } else {
    if (suffix) suffix.textContent = '$';
    if (input) { input.removeAttribute('max'); input.placeholder = '10'; }
  }
  updateDiscountPreview();
}

/* ---------- Quick fill ---------- */
function quickFill(value) {
  const input = document.getElementById('dcValue');
  if (!input) return;
  input.value = value;
  input.focus();
  updateDiscountPreview();
}

/* ---------- Live preview ---------- */
function updateDiscountPreview() {
  const code  = (document.getElementById('dcCode')?.value || '').trim().toUpperCase();
  const value = parseFloat(document.getElementById('dcValue')?.value) || 0;
  const type  = document.getElementById('dcType')?.value || 'percent';

  const previewCode  = document.getElementById('previewCode');
  const previewValue = document.getElementById('previewValue');

  if (previewCode) previewCode.textContent = code || 'YOURCODE';
  if (previewValue) {
    previewValue.textContent = type === 'percent'
      ? `${value}% off`
      : `$${value.toFixed(2)} off`;
  }
}

/* ---------- Save ---------- */
function saveDiscount() {
  const code       = (document.getElementById('dcCode').value || '').trim().toUpperCase();
  const type       = document.getElementById('dcType').value;
  const value      = parseFloat(document.getElementById('dcValue').value);
  const maxUsesRaw = document.getElementById('dcMaxUses').value;
  const maxUses    = maxUsesRaw === '' ? null : parseInt(maxUsesRaw, 10);
  const expires    = document.getElementById('dcExpires').value || null;
  const isActive   = document.getElementById('dcActive').checked ? 1 : 0;

  if (!code) return showToast('❌ Code is required', 'error');
  if (code.length < 3) return showToast('❌ Code must be at least 3 characters', 'error');
  if (!value || value <= 0) return showToast('❌ Value must be greater than 0', 'error');
  if (type === 'percent' && value > 100) return showToast('❌ Percentage cannot exceed 100', 'error');

  if (discounts.some(d => d.code === code)) {
    return showToast('❌ That code already exists', 'error');
  }

  discounts.push({
    id: 'dc-' + Date.now(),
    code,
    discount_type: type,
    discount_value: value,
    max_uses: maxUses,
    uses_count: 0,
    used_by: [],              // <-- tracks phone numbers of customers
    expires_at: expires,
    is_active: isActive,
    created_at: new Date().toISOString()
  });

  setData('amaze_discounts', discounts);
  renderDiscounts();
  closeDiscountModal();
  showToast('✅ Discount code "' + code + '" created');
}

/* ---------- Toggle ---------- */
function toggleDiscount(id) {
  const d = discounts.find(x => x.id === id);
  if (!d) return;
  d.is_active = d.is_active ? 0 : 1;
  setData('amaze_discounts', discounts);
  renderDiscounts();
  showToast('🔄 Code ' + (d.is_active ? 'enabled' : 'disabled'));
}

/* ---------- Copy ---------- */
function copyDiscount(code) {
  navigator.clipboard?.writeText(code).then(() => {
    showToast('📋 Copied "' + code + '"');
  }).catch(() => {
    showToast('Code: ' + code);
  });
}

/* ---------- Delete ---------- */
function deleteDiscount(id) {
  const d = discounts.find(x => x.id === id);
  if (!d) return;
  if (confirm('⚠️ Delete code "' + d.code + '"?')) {
    discounts = discounts.filter(x => x.id !== id);
    setData('amaze_discounts', discounts);
    renderDiscounts();
    showToast('🗑️ Deleted');
  }
}

/* ============================================================
   SIDEBAR NAV
   ============================================================ */
document.querySelectorAll('.sidebar-menu a').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    this.classList.add('active');

    const page = this.dataset.page;
    const sections = {
      'dashboard':  null,
      'orders':     'ordersSection',
      'inventory':  'inventorySection',
      'stock':      'stockSection',
      'reviews':    'reviewsSection',
      'discounts':  'discountsSection'
    };
    const sectionId = sections[page];
    if (sectionId) {
      document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
});

/* ============================================================
   STATS ANIMATION
   ============================================================ */
function animateStats() {
  document.querySelectorAll('.stat-number').forEach(counter => {
    const target = parseInt(counter.textContent.replace(/[^0-9]/g, ''), 10);
    if (isNaN(target) || target === 0) return;

    let current = 0;
    const increment = Math.max(1, Math.ceil(target / 40));
    const stepTime = 800 / 40;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        counter.textContent = target;
        clearInterval(timer);
      } else {
        counter.textContent = current;
      }
    }, stepTime);
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateDashboard();
  animateStats();

  document.getElementById('discountModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDiscountModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDiscountModal();
  });

  document.getElementById('dcCode')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    updateDiscountPreview();
  });
  document.getElementById('dcValue')?.addEventListener('input', updateDiscountPreview);
  document.getElementById('dcType')?.addEventListener('change', function () {
    setDiscountType(this.value);
  });

  console.log('✨ AMAZE Admin Dashboard Loaded');
  console.log('📊 Orders:', orders.length);
  console.log('📦 Products:', inventory.length);
  console.log('⭐ Pending Reviews:', getPendingReviews().length);
  console.log('🏷️ Discounts:', discounts.length);
});

/* ============================================================
   EXPOSE TO GLOBAL
   ============================================================ */
window.addProduct             = addProduct;
window.restockItem            = restockItem;
window.quickRestock           = quickRestock;
window.setStockToZero         = setStockToZero;
window.deleteProduct          = deleteProduct;
window.clearAllOrders         = clearAllOrders;
window.approveReview          = approveReview;
window.rejectReview           = rejectReview;
window.getPendingReviews      = getPendingReviews;
window.openDiscountModal      = openDiscountModal;
window.closeDiscountModal     = closeDiscountModal;
window.saveDiscount           = saveDiscount;
window.toggleDiscount         = toggleDiscount;
window.copyDiscount           = copyDiscount;
window.deleteDiscount         = deleteDiscount;
window.setDiscountType        = setDiscountType;
window.quickFill              = quickFill;
window.updateDiscountPreview  = updateDiscountPreview;
window.adminLogout            = adminLogout;