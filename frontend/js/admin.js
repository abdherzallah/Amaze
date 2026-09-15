/* ============================================================
   AMAZE · Admin Dashboard JavaScript
   ============================================================ */

/* ---------- DATA HELPERS ---------- */
function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- TOAST ---------- */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ---------- DATA ---------- */
let orders = getData('amaze_orders', []);
let inventory = getData('amaze_inventory', []);
let reviews = getData('amaze_reviews', []);

/* ============================================================
   DASHBOARD
   ============================================================ */
function updateDashboard() {
  const totalOrders = orders.length;
  const totalProducts = inventory.length;

  document.getElementById('totalOrders').textContent = totalOrders;
  document.getElementById('totalProducts').textContent = totalProducts;
  document.getElementById('orderBadge').textContent = totalOrders;
  document.getElementById('reviewBadge').textContent = getPendingReviews().length;

  // Orders change indicator
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
  changeEl.textContent = (ordersChange >= 0 ? '↑ ' : '↓ ') + Math.abs(ordersChange) + '% this month';
  changeEl.className = 'stat-change ' + (ordersChange >= 0 ? 'up' : 'down');

  document.getElementById('productsChange').textContent = totalProducts + ' total';

  updateOrdersList();
  updateInventory();
  updateStockAlerts();
  updateReviewsList();
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
    const statusClass = order.status || 'pending';
    const statusText = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
    const statusIcon =
      statusClass === 'completed' ? '✓' :
      statusClass === 'shipped'   ? '🚚' :
      statusClass === 'pending'   ? '⏳' : '✗';

    html += `
      <tr>
        <td><strong>#${order.id || 'AMZ-' + String(index + 1).padStart(3, '0')}</strong></td>
        <td>${order.customer || 'Guest'}</td>
        <td>${order.date || new Date().toLocaleDateString()}</td>
        <td>$${order.total.toFixed(2)}</td>
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
    const stockColor =
      item.stock < 20 ? '#b45f4b' :
      item.stock < 50 ? '#f39c12' : '#2d7d46';
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

/* ============================================================
   STOCK ACTIONS
   ============================================================ */
function restockItem(index) {
  const input = document.getElementById('stockInput_' + index);
  const amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount < 0) {
    showToast('Please enter a valid number (0 or more)', 'error');
    return;
  }

  const item = inventory[index];
  if (item) {
    item.stock += amount;
    setData('amaze_inventory', inventory);
    updateDashboard();
    showToast(amount === 0
      ? 'ℹ️ Stock unchanged for ' + item.name
      : '✅ Added ' + amount + ' units to ' + item.name);
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
    showToast('🔄 Stock set to 0 for ' + item.name);
  }
}

function deleteProduct(index) {
  const item = inventory[index];
  if (confirm('⚠️ Are you sure you want to delete "' + item.name + '"?')) {
    inventory.splice(index, 1);
    setData('amaze_inventory', inventory);
    updateDashboard();
    showToast('🗑️ Deleted ' + item.name);
  }
}

/* ============================================================
   STOCK ALERTS
   ============================================================ */
function updateStockAlerts() {
  const container = document.getElementById('stockAlertsContainer');
  const alertText = document.getElementById('stockAlertText');
  const stockBadge = document.getElementById('stockBadge');
  if (!container) return;

  const lowStockItems = inventory.filter(item => item.stock < 20);
  stockBadge.textContent = lowStockItems.length;

  if (lowStockItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color:#2d7d46;"></i>
        <p>All items are well stocked</p>
        <span>No alerts at this time</span>
      </div>
    `;
    alertText.textContent = '✅ All items in stock';
    alertText.style.color = '#2d7d46';
    return;
  }

  alertText.textContent = '⚠️ ' + lowStockItems.length + ' item' +
    (lowStockItems.length > 1 ? 's' : '') + ' need restock';
  alertText.style.color = '#b45f4b';

  let html = '';
  lowStockItems.forEach((item) => {
    const color = item.stock < 10 ? '#b45f4b' : '#f39c12';
    const actualIndex = inventory.indexOf(item);
    const stockDisplay = item.stock === 0 ? 'Out of Stock' : item.stock + ' units left';
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
function getPendingReviews() {
  return reviews.filter(r => r.status === 'pending');
}

function updateReviewsList() {
  const container = document.getElementById('reviewsContainer');
  const countText = document.getElementById('reviewCountText');
  if (!container) return;

  const pending = getPendingReviews();
  countText.textContent = pending.length + ' pending review' +
    (pending.length !== 1 ? 's' : '');
  document.getElementById('reviewBadge').textContent = pending.length;

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
          <span class="review-date">${review.date}</span>
          <span style="font-size:11px; color:#8a7a6e;">${review.id}</span>
        </div>
        <div class="review-actions">
          <button class="btn-approve" onclick="approveReview('${review.id}')">
            <i class="fas fa-check"></i> Approve
          </button>
          <button class="btn-reject" onclick="rejectReview('${review.id}')">
            <i class="fas fa-times"></i> Reject
          </button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function approveReview(reviewId) {
  const review = reviews.find(r => r.id === reviewId);
  if (review) {
    review.status = 'approved';
    setData('amaze_reviews', reviews);
    updateDashboard();
    showToast('✅ Review approved!');
  }
}

function rejectReview(reviewId) {
  const review = reviews.find(r => r.id === reviewId);
  if (review) {
    review.status = 'rejected';
    setData('amaze_reviews', reviews);
    updateDashboard();
    showToast('❌ Review rejected');
  }
}

/* ============================================================
   ADD PRODUCT
   ============================================================ */
function addProduct() {
  const name = prompt('Enter product name:');
  if (!name || !name.trim()) return;

  const sku = prompt('Enter SKU (e.g., AMZ-001):');
  if (!sku || !sku.trim()) return;

  const stock = parseInt(prompt('Enter initial stock count (default 0):') || '0', 10);

  inventory.push({
    name: name.trim(),
    sku: sku.trim().toUpperCase(),
    stock: stock || 0,
    icon: 'fa-box'
  });
  setData('amaze_inventory', inventory);
  updateDashboard();
  showToast('✅ Product "' + name.trim() + '" added successfully!');
}

/* ============================================================
   CLEAR ALL ORDERS
   ============================================================ */
function clearAllOrders() {
  if (orders.length === 0) return;
  if (confirm('⚠️ Are you sure you want to clear all orders?')) {
    orders = [];
    setData('amaze_orders', orders);
    updateDashboard();
    showToast('✅ All orders cleared');
  }
}

/* ============================================================
   SIDEBAR NAVIGATION
   ============================================================ */
document.querySelectorAll('.sidebar-menu a').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    this.classList.add('active');

    const page = this.dataset.page;
    const sections = {
      'dashboard': null,
      'orders':    'ordersSection',
      'inventory': 'inventorySection',
      'stock':     'stockSection',
      'reviews':   'reviewsSection'
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
   STATS COUNTER ANIMATION
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

  console.log('✨ AMAZE Admin Dashboard Loaded');
  console.log('📊 Orders:', orders.length);
  console.log('📦 Products:', inventory.length);
  console.log('⭐ Pending Reviews:', getPendingReviews().length);
});

/* ============================================================
   EXPOSE FUNCTIONS TO GLOBAL SCOPE
   (needed because the HTML uses inline onclick="..." handlers)
   ============================================================ */
window.addProduct     = addProduct;
window.restockItem    = restockItem;
window.quickRestock   = quickRestock;
window.setStockToZero = setStockToZero;
window.deleteProduct  = deleteProduct;
window.clearAllOrders = clearAllOrders;
window.approveReview  = approveReview;
window.rejectReview   = rejectReview;
window.getPendingReviews = getPendingReviews;