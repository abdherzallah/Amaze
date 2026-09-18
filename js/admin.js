/* ============================================================
   AMAZE · admin.js — everything via the API
   ============================================================ */

let orders    = [];
let inventory = [];
let reviews   = [];
let discounts = [];
let csrfToken = '';

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 3500);
}

function apiHeaders(extra = {}) {
  return Object.assign({
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  }, extra);
}

async function adminFetch(url, options = {}) {
  const opts = Object.assign({ credentials: 'same-origin' }, options);
  opts.headers = apiHeaders(opts.headers || {});
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) {
    window.location.replace('admin-login.html');
    return null;
  }
  return data;
}

async function adminLogout() {
  if (!confirm('Log out?')) return;
  try { await fetch('api/auth.php?action=logout', { method: 'POST', headers: apiHeaders(), credentials: 'same-origin' }); } catch (e) {}
  window.location.href = 'admin-login.html';
}
window.adminLogout = adminLogout;

function goTo(page) {
  document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
  document.querySelector(`.sidebar-menu a[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.goTo = goTo;

async function loadOrders() {
  const d = await adminFetch('api/orders.php');
  if (d && d.ok) orders = d.orders || [];
}
async function loadReviews() {
  const d = await adminFetch('api/reviews.php?all=1');
  if (d && d.ok) reviews = d.reviews || [];
}
async function loadDiscounts() {
  const d = await adminFetch('api/discounts.php');
  if (d && d.ok) discounts = d.discounts || [];
}
async function loadInventory() {
  const d = await adminFetch('api/products.php');
  if (d && d.ok) {
    inventory = (d.products || []).map(p => ({
      id: p.id, name: p.name,
      sku: 'AMZ-' + String(p.id).padStart(3, '0'),
      stock: p.stock || 0, icon: 'fa-box'
    }));
  }
}

function updateDashboard() {
  const totalOrders   = orders.length;
  const totalRevenue  = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalProducts = inventory.length;
  const active        = discounts.filter(d => d.is_active).length;

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('totalOrders', totalOrders);
  set('totalRevenue', '$' + totalRevenue.toFixed(0));
  set('totalProducts', totalProducts);
  set('totalDiscounts', active);

  const pending = reviews.filter(r => r.status === 'pending').length;
  const ob = document.getElementById('orderBadge');  if (ob) ob.textContent = totalOrders;
  const rb = document.getElementById('reviewBadge'); if (rb) rb.textContent = pending;
  const tp = document.getElementById('tabPendingCount'); if (tp) tp.textContent = pending;

  updateRecentActivity();
  updateOrdersList();
  updateInventory();
  renderDiscounts();
  updateReviewsList();
}

function updateRecentActivity() {
  const c = document.getElementById('recentActivity');
  if (!c) return;
  const recent = orders.slice(0, 5);
  if (!recent.length) { c.innerHTML = '<div class="empty-compact"><i class="fas fa-inbox"></i><span>No recent activity</span></div>'; return; }
  c.innerHTML = recent.map(o => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f5f0eb;">
      <div>
        <div style="font-weight:600;font-size:13px;">#${escapeHtml(o.order_code || o.id)} — ${escapeHtml(o.full_name || 'Guest')}</div>
        <div style="font-size:11px;color:#8a7a6e;">${escapeHtml(o.created_at || '')}</div>
      </div>
      <div style="font-weight:700;color:#b45f4b;">$${Number(o.total || 0).toFixed(2)}</div>
    </div>`).join('');
}

function updateOrdersList() {
  const c = document.getElementById('ordersContainer');
  if (!c) return;
  if (!orders.length) { c.innerHTML = '<div class="empty-compact"><i class="fas fa-box-open"></i><span>No orders yet.</span></div>'; return; }
  let html = '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>';
  orders.forEach(o => {
    const s = o.status || 'completed';
    html += `<tr><td><strong>#${escapeHtml(o.order_code || o.id)}</strong></td><td>${escapeHtml(o.full_name || 'Guest')}</td><td>${escapeHtml(o.created_at || '')}</td><td><strong>$${Number(o.total || 0).toFixed(2)}</strong></td><td><span class="status ${s}">${s}</span></td></tr>`;
  });
  html += '</tbody></table></div>';
  c.innerHTML = html;
}

function updateInventory() {
  const g = document.getElementById('inventoryGrid');
  if (!g) return;
  if (!inventory.length) { g.innerHTML = '<div class="empty-compact" style="grid-column:1/-1;"><i class="fas fa-box-open"></i><span>No products.</span></div>'; return; }
  g.innerHTML = inventory.map((item, i) => {
    const pct = Math.min((item.stock / 200) * 100, 100);
    const col = item.stock < 20 ? '#b45f4b' : item.stock < 50 ? '#f39c12' : '#2d7d46';
    const disp = item.stock === 0 ? 'Out of Stock' : item.stock + ' units';
    return `
      <div class="inventory-item">
        <div class="item-name"><i class="fas ${item.icon}"></i> ${escapeHtml(item.name)}</div>
        <div class="item-sku">SKU: ${escapeHtml(item.sku)}</div>
        <div class="item-stock">
          <span style="font-weight:600;color:${item.stock === 0 ? '#b45f4b' : col};">${disp}</span>
          <div class="stock-bar"><div class="fill" style="width:${pct}%;background:${item.stock === 0 ? '#b45f4b' : col};"></div></div>
        </div>
        <div class="stock-actions">
          <input type="number" id="stockInput_${i}" min="0" value="10">
          <button class="btn-restock" onclick="restockItem(${i})">+ Add</button>
          <button class="btn-restock-small" onclick="quickRestock(${i}, 50)">+50</button>
          <button class="btn-restock-small" onclick="quickRestock(${i}, 100)">+100</button>
          <button class="btn-set-zero" onclick="setStockToZero(${i})">Set 0</button>
        </div>
      </div>`;
  }).join('');
}

async function restockItem(i) {
  const input = document.getElementById('stockInput_' + i);
  const amt = parseInt(input.value, 10);
  if (isNaN(amt) || amt <= 0) return showToast('Enter a positive number', 'error');
  const item = inventory[i];
  if (!item) return;
  const newStock = (item.stock || 0) + amt;
  const d = await adminFetch('api/products.php?id=' + item.id, { method: 'PUT', body: { stock: newStock } });
  if (d && d.ok) { item.stock = newStock; updateDashboard(); showToast('✅ Added ' + amt + ' units'); }
  else showToast('❌ ' + (d && d.error || 'Update failed'), 'error');
}
window.restockItem = restockItem;

async function quickRestock(i, amt) {
  const item = inventory[i];
  if (!item) return;
  const newStock = (item.stock || 0) + amt;
  const d = await adminFetch('api/products.php?id=' + item.id, { method: 'PUT', body: { stock: newStock } });
  if (d && d.ok) { item.stock = newStock; updateDashboard(); showToast('✅ Added ' + amt + ' units'); }
  else showToast('❌ ' + (d && d.error || 'Update failed'), 'error');
}
window.quickRestock = quickRestock;

async function setStockToZero(i) {
  const item = inventory[i];
  if (!item) return;
  if (!confirm('Set stock of "' + item.name + '" to 0?')) return;
  const d = await adminFetch('api/products.php?id=' + item.id, { method: 'PUT', body: { stock: 0 } });
  if (d && d.ok) { item.stock = 0; updateDashboard(); showToast('Stock set to 0'); }
  else showToast('❌ ' + (d && d.error || 'Update failed'), 'error');
}
window.setStockToZero = setStockToZero;

function renderDiscounts() {
  const c = document.getElementById('discountsContainer');
  if (!c) return;
  if (!discounts.length) { c.innerHTML = '<div class="empty-compact"><i class="fas fa-tags"></i><span>No codes yet.</span></div>'; return; }
  const now = new Date();
  c.innerHTML = '<div class="discounts-grid">' + discounts.map(d => {
    const exp = d.expires_at && new Date(d.expires_at) < now;
    const mx  = d.max_uses && d.uses_count >= d.max_uses;
    const ina = !d.is_active || exp || mx;
    const val = d.discount_type === 'percent'
      ? `${d.discount_value}<small>% off</small>`
      : `$${Number(d.discount_value).toFixed(2)}<small>off</small>`;
    return `
      <div class="discount-card ${ina ? 'inactive' : ''}">
        <div class="dc-head">
          <span class="dc-code">${escapeHtml(d.code)}</span>
          <span class="dc-status ${ina ? 'off' : 'on'}">${ina ? (exp ? 'Expired' : mx ? 'Used Up' : 'Inactive') : 'Active'}</span>
        </div>
        <div class="dc-value">${val}</div>
        <div class="dc-meta">
          <div><i class="fas fa-redo"></i> Used: ${d.uses_count || 0}${d.max_uses ? ' / ' + d.max_uses : ' / ∞'}</div>
          <div><i class="fas fa-calendar"></i> ${d.expires_at ? 'Expires ' + d.expires_at : 'Never expires'}</div>
        </div>
        <div class="dc-actions">
          <button class="btn-toggle" onclick="toggleDiscount(${d.id})"><i class="fas fa-power-off"></i> ${d.is_active ? 'Disable' : 'Enable'}</button>
          <button class="btn-copy" onclick="copyDiscount('${escapeHtml(d.code)}')"><i class="fas fa-copy"></i> Copy</button>
          <button class="btn-delete" onclick="deleteDiscount(${d.id})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
  }).join('') + '</div>';
}

function openDiscountModal() {
  document.getElementById('dcCode').value = '';
  document.getElementById('dcType').value = 'percent';
  document.getElementById('dcValue').value = '';
  document.getElementById('dcMaxUses').value = '';
  document.getElementById('dcExpires').value = '';
  document.getElementById('dcActive').checked = true;
  document.getElementById('dcValueSuffix').textContent = '%';
  document.getElementById('discountModal').classList.add('active');
  setTimeout(() => document.getElementById('dcCode')?.focus(), 200);
}
window.openDiscountModal = openDiscountModal;

function closeDiscountModal() { document.getElementById('discountModal').classList.remove('active'); }
window.closeDiscountModal = closeDiscountModal;

function quickFill(v) { const i = document.getElementById('dcValue'); if (i) { i.value = v; i.focus(); } }
window.quickFill = quickFill;

async function saveDiscount() {
  const code = (document.getElementById('dcCode').value || '').trim().toUpperCase();
  const type = document.getElementById('dcType').value;
  const val  = parseFloat(document.getElementById('dcValue').value);
  const maxR = document.getElementById('dcMaxUses').value;
  const exp  = document.getElementById('dcExpires').value || null;
  const act  = document.getElementById('dcActive').checked ? 1 : 0;

  if (!code) return showToast('❌ Code required', 'error');
  if (!val || val <= 0) return showToast('❌ Value must be > 0', 'error');
  if (type === 'percent' && val > 100) return showToast('❌ Max 100%', 'error');

  const d = await adminFetch('api/discounts.php', {
    method: 'POST',
    body: { code, discount_type: type, discount_value: val,
            max_uses: maxR === '' ? null : parseInt(maxR, 10),
            expires_at: exp, is_active: act }
  });
  if (d && d.ok) { closeDiscountModal(); showToast('✅ Code "' + code + '" created'); await loadDiscounts(); updateDashboard(); }
  else showToast('❌ ' + (d && d.error || 'Failed'), 'error');
}
window.saveDiscount = saveDiscount;

async function toggleDiscount(id) {
  const d = discounts.find(x => Number(x.id) === Number(id));
  if (!d) return;
  const r = await adminFetch('api/discounts.php?id=' + id, {
    method: 'PUT', body: { is_active: d.is_active ? 0 : 1 }
  });
  if (r && r.ok) { showToast('Code ' + (d.is_active ? 'disabled' : 'enabled')); await loadDiscounts(); updateDashboard(); }
}
window.toggleDiscount = toggleDiscount;

function copyDiscount(code) {
  navigator.clipboard?.writeText(code).then(() => showToast('📋 Copied "' + code + '"'))
    .catch(() => showToast('Code: ' + code));
}
window.copyDiscount = copyDiscount;

async function deleteDiscount(id) {
  if (!confirm('Delete this code?')) return;
  const d = await adminFetch('api/discounts.php?id=' + id, { method: 'DELETE' });
  if (d && d.ok) { showToast('🗑️ Deleted'); await loadDiscounts(); updateDashboard(); }
}
window.deleteDiscount = deleteDiscount;

let currentReviewTab = 'pending';
function switchReviewTab(tab) {
  currentReviewTab = tab;
  document.querySelectorAll('.review-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  updateReviewsList();
}
window.switchReviewTab = switchReviewTab;

function updateReviewsList() {
  const c = document.getElementById('reviewsContainer');
  if (!c) return;
  const f = reviews.filter(r => r.status === currentReviewTab);
  if (!f.length) { c.innerHTML = `<div class="review-group-empty">No ${currentReviewTab} reviews.</div>`; return; }
  c.innerHTML = f.map(r => {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    let actions = '';
    if (r.status === 'pending') {
      actions = `<button class="btn-approve" onclick="approveReview(${r.id})"><i class="fas fa-check"></i> Approve</button>
                 <button class="btn-reject" onclick="rejectReview(${r.id})"><i class="fas fa-times"></i> Reject</button>`;
    } else if (r.status === 'approved') {
      actions = `<button class="btn-reject" onclick="rejectReview(${r.id})"><i class="fas fa-times"></i> Reject</button>
                 <button class="btn-delete-review" onclick="deleteReview(${r.id})"><i class="fas fa-trash-alt"></i> Delete</button>`;
    } else {
      actions = `<button class="btn-approve" onclick="approveReview(${r.id})"><i class="fas fa-check"></i> Approve</button>
                 <button class="btn-delete-review" onclick="deleteReview(${r.id})"><i class="fas fa-trash-alt"></i> Delete</button>`;
    }
    return `
      <div class="review-item">
        <div class="review-header">
          <div>
            <span class="review-stars">${stars}</span>
            <span class="review-user">${escapeHtml(r.user_name)}</span>
            ${r.location ? `<span class="review-loc">· ${escapeHtml(r.location)}</span>` : ''}
          </div>
          <span class="review-status ${r.status}">${r.status}</span>
        </div>
        <div class="review-text">"${escapeHtml(r.text)}"</div>
        <div class="review-meta"><span>${escapeHtml(r.created_at || '')}</span></div>
        <div class="review-actions">${actions}</div>
      </div>`;
  }).join('');
}

async function approveReview(id) {
  const d = await adminFetch('api/reviews.php?id=' + id, { method: 'PUT', body: { status: 'approved' } });
  if (d && d.ok) { showToast('✅ Approved'); await loadReviews(); updateDashboard(); }
}
window.approveReview = approveReview;

async function rejectReview(id) {
  const d = await adminFetch('api/reviews.php?id=' + id, { method: 'PUT', body: { status: 'rejected' } });
  if (d && d.ok) { showToast('❌ Rejected'); await loadReviews(); updateDashboard(); }
}
window.rejectReview = rejectReview;

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  const d = await adminFetch('api/reviews.php?id=' + id, { method: 'DELETE' });
  if (d && d.ok) { showToast('🗑️ Deleted'); await loadReviews(); updateDashboard(); }
}
window.deleteReview = deleteReview;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.amazeAuthPromise) {
    const admin = await window.amazeAuthPromise;
    if (!admin) return;
    csrfToken = window.__amazeCsrf || '';
    if (typeof setCsrfToken === 'function') setCsrfToken(csrfToken);

    const nameEl = document.getElementById('adminName');
    const avEl   = document.getElementById('adminAvatar');
    const disp   = (admin.name || admin.username || 'Admin').trim();
    const pretty = disp.charAt(0).toUpperCase() + disp.slice(1);
    if (nameEl) nameEl.textContent = pretty;
    if (avEl)   avEl.textContent = pretty.charAt(0);
  }

  await Promise.all([loadOrders(), loadReviews(), loadDiscounts(), loadInventory()]);
  updateDashboard();

  document.querySelectorAll('.sidebar-menu a').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); goTo(l.dataset.page); });
  });

  document.getElementById('dcType')?.addEventListener('change', function () {
    document.getElementById('dcValueSuffix').textContent = this.value === 'percent' ? '%' : '$';
  });
  document.getElementById('discountModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDiscountModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDiscountModal(); });

  console.log('✨ AMAZE admin loaded');
});