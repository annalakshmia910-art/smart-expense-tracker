(() => {
  'use strict';

  const CATEGORIES = ['Food', 'Travel', 'Education', 'Shopping', 'Entertainment', 'Healthcare', 'Bills', 'Other'];
  const COLORS = ['#8170e8', '#5a8dee', '#ee9b69', '#53b998', '#dd7191', '#7c91b6', '#bd91e5', '#e4b858'];
  const SYMBOLS = { Food: '◒', Travel: '↗', Education: '▤', Shopping: '◇', Entertainment: '♫', Healthcare: '✚', Bills: '⌑', Other: '＋' };
  const STORAGE_KEY = 'spendwise.transactions.v1';
  const BUDGET_KEY = 'spendwise.monthlyBudget.v1';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const todayLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && todayParts(parsed) === value;
  };
  const todayParts = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const money = (value, decimals = 2) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value) || 0);
  const shortMoney = (value) => money(value, 0);
  const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const monthTitle = (date, year = false) => new Intl.DateTimeFormat('en-IN', { month: 'short', ...(year ? { year: '2-digit' } : {}) }).format(date);
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  function normalizeTransactions(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && item.id.length <= 100 && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 80 && Number.isFinite(item.amount) && item.amount > 0 && item.amount <= 1e12 && CATEGORIES.includes(item.category) && validDate(item.date) && (item.description == null || typeof item.description === 'string')).map((item) => ({
      id: item.id, title: item.title.trim(), amount: Number(item.amount), category: item.category, date: item.date,
      description: typeof item.description === 'string' ? item.description.slice(0, 240) : ''
    }));
  }

  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  }

  let transactions = normalizeTransactions(loadJSON(STORAGE_KEY, []));
  const savedBudget = loadJSON(BUDGET_KEY, null);
  let budget = Number.isFinite(savedBudget) && savedBudget > 0 && savedBudget <= 1e12 ? savedBudget : null;
  let chartInstances = {};
  let toastTimer;

  function persistTransactions() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); return true; }
    catch { showToast('Could not save data. Check browser storage space or permissions.', 'error'); return false; }
  }
  function persistBudget(value) {
    try { if (value === null) localStorage.removeItem(BUDGET_KEY); else localStorage.setItem(BUDGET_KEY, JSON.stringify(value)); return true; }
    catch { showToast('Could not save your budget. Check browser storage permissions.', 'error'); return false; }
  }
  function showToast(message, kind = 'success') {
    const region = $('#toast-region'); region.replaceChildren();
    const toast = document.createElement('div'); toast.className = `toast ${kind}`; toast.textContent = message; region.append(toast);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.remove(), 3500);
  }
  function monthTransactions() { const current = monthKey(new Date()); return transactions.filter((tx) => tx.date.slice(0, 7) === current); }
  function categoryTotals(list) { const totals = Object.fromEntries(CATEGORIES.map((category) => [category, 0])); list.forEach((tx) => { totals[tx.category] += tx.amount; }); return totals; }
  function highestCategory(list) { const totals = categoryTotals(list); const top = Object.entries(totals).filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1])[0]; return top || null; }
  function categoryColor(category) { return COLORS[CATEGORIES.indexOf(category)] || COLORS.at(-1); }
  function categoryIcon(category) { return SYMBOLS[category] || '＋'; }
  function getSixMonths() { const now = new Date(); return Array.from({ length: 6 }, (_, index) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1); return { key: monthKey(d), label: monthTitle(d, true), total: 0 }; }); }
  function monthlyTotals() { const months = getSixMonths(); const index = Object.fromEntries(months.map((month, i) => [month.key, i])); transactions.forEach((tx) => { const slot = index[tx.date.slice(0, 7)]; if (slot !== undefined) months[slot].total += tx.amount; }); return months; }

  function initNavigation() {
    $$('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
    window.addEventListener('hashchange', () => { const target = location.hash.slice(1); if (['dashboard', 'transactions', 'add', 'analytics', 'budget'].includes(target)) navigate(target, false); });
    const requested = location.hash.slice(1); navigate(['dashboard', 'transactions', 'add', 'analytics', 'budget'].includes(requested) ? requested : 'dashboard', false);
  }
  function navigate(view, updateHash = true) {
    const safe = ['dashboard', 'transactions', 'add', 'analytics', 'budget'].includes(view) ? view : 'dashboard';
    $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${safe}`));
    $$('.nav-item, .mobile-nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === safe));
    const names = { dashboard: 'Dashboard', transactions: 'Transactions', add: $('#expense-id').value ? 'Edit expense' : 'Add expense', analytics: 'Analytics', budget: 'Budget settings' };
    $('#page-name').textContent = names[safe];
    if (updateHash && location.hash !== `#${safe}`) history.replaceState(null, '', `#${safe}`);
    if (safe === 'add') $('#title-input').focus({ preventScroll: true });
    if (safe === 'transactions') renderTransactions();
  }

  function initForm() {
    $('#category-input').innerHTML = '<option value="">Choose a category</option>' + CATEGORIES.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
    $('#category-filter').innerHTML = '<option value="all">All categories</option>' + CATEGORIES.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
    $('#date-input').value = todayLocal();
    $('#description-input').addEventListener('input', (event) => { $('#description-count').textContent = event.target.value.length; });
    $('#expense-form').addEventListener('submit', saveExpense);
    $('#cancel-edit').addEventListener('click', resetForm);
    $('#search-input').addEventListener('input', renderTransactions);
    $('#category-filter').addEventListener('change', renderTransactions);
    $('#sort-select').addEventListener('change', renderTransactions);
    $('#export-btn').addEventListener('click', exportCSV);
    $('#clear-btn').addEventListener('click', clearTransactions);
    $('#budget-form').addEventListener('submit', saveBudget);
    $('#title-input').addEventListener('input', () => clearFieldError('title'));
    $('#amount-input').addEventListener('input', () => clearFieldError('amount'));
  }
  function clearFieldError(name) { $(`#${name}-error`).textContent = ''; const input = $(`#${name}-input`); if (input) input.removeAttribute('aria-invalid'); }
  function setFieldError(name, message) { $(`#${name}-error`).textContent = message; const input = $(`#${name}-input`); if (input) input.setAttribute('aria-invalid', 'true'); }
  function validateExpense() {
    ['title', 'amount', 'category', 'date'].forEach(clearFieldError);
    const title = $('#title-input').value.trim(); const amount = Number($('#amount-input').value); const category = $('#category-input').value; const date = $('#date-input').value;
    let valid = true;
    if (!title) { setFieldError('title', 'Please enter an expense title.'); valid = false; }
    else if (title.length > 80) { setFieldError('title', 'Title must be 80 characters or fewer.'); valid = false; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) { setFieldError('amount', 'Enter an amount greater than 0 and no more than ₹1,000,000,000,000.'); valid = false; }
    if (!CATEGORIES.includes(category)) { setFieldError('category', 'Choose a category.'); valid = false; }
    if (!validDate(date)) { setFieldError('date', 'Choose a valid calendar date.'); valid = false; }
    if (!valid) { const first = $('.field-error:not(:empty)'); if (first) first.previousElementSibling?.focus?.(); }
    return valid ? { title, amount, category, date, description: $('#description-input').value.trim().slice(0, 240) } : null;
  }
  function saveExpense(event) {
    event.preventDefault(); const values = validateExpense(); if (!values) return;
    const id = $('#expense-id').value;
    if (id) { const index = transactions.findIndex((tx) => tx.id === id); if (index < 0) { showToast('That expense could not be found. Please try again.', 'error'); resetForm(); return; } transactions[index] = { ...transactions[index], ...values }; }
    else transactions.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...values });
    if (!persistTransactions()) return;
    resetForm(); renderAll(); navigate('dashboard'); showToast(id ? 'Expense updated successfully.' : 'Expense saved successfully.');
  }
  function editExpense(id) {
    const tx = transactions.find((entry) => entry.id === id); if (!tx) return;
    $('#expense-id').value = tx.id; $('#title-input').value = tx.title; $('#amount-input').value = tx.amount; $('#category-input').value = tx.category; $('#date-input').value = tx.date; $('#description-input').value = tx.description;
    $('#description-count').textContent = tx.description.length; $('#form-title').textContent = 'Edit expense'; $('#submit-expense').innerHTML = 'Save changes <span>→</span>'; $('#cancel-edit').classList.remove('hidden'); navigate('add');
  }
  function resetForm() {
    $('#expense-form').reset(); $('#expense-id').value = ''; $('#date-input').value = todayLocal(); $('#description-count').textContent = '0'; $('#form-title').textContent = 'Add an expense'; $('#submit-expense').innerHTML = 'Save expense <span>→</span>'; $('#cancel-edit').classList.add('hidden'); ['title', 'amount', 'category', 'date'].forEach(clearFieldError);
  }
  function deleteExpense(id) {
    const tx = transactions.find((entry) => entry.id === id); if (!tx) return;
    if (!window.confirm(`Delete “${tx.title}” (${money(tx.amount)})? This cannot be undone.`)) return;
    transactions = transactions.filter((entry) => entry.id !== id); if (!persistTransactions()) return;
    renderAll(); showToast('Expense deleted.');
  }
  function transactionRow(tx, actions = false) {
    return `<tr><td><div class="transaction-name"><span class="category-icon" style="background:${categoryColor(tx.category)}18;color:${categoryColor(tx.category)}">${categoryIcon(tx.category)}</span><span>${escapeHTML(tx.title)}${tx.description ? `<small class="row-description">${escapeHTML(tx.description)}</small>` : ''}</span></div></td><td><span class="category-badge"><span class="legend-dot" style="background:${categoryColor(tx.category)}"></span>${escapeHTML(tx.category)}</span></td><td>${dateLabel(tx.date)}</td><td class="amount-cell">${money(tx.amount)}</td>${actions ? `<td><div class="action-buttons"><button class="icon-button edit" type="button" data-edit="${escapeHTML(tx.id)}" aria-label="Edit ${escapeHTML(tx.title)}" title="Edit">✎</button><button class="icon-button delete" type="button" data-delete="${escapeHTML(tx.id)}" aria-label="Delete ${escapeHTML(tx.title)}" title="Delete">×</button></div></td>` : ''}</tr>`;
  }
  function bindRowActions(root) {
    root.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editExpense(button.dataset.edit)));
    root.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteExpense(button.dataset.delete)));
  }
  function filteredTransactions() {
    const query = $('#search-input').value.trim().toLowerCase(); const category = $('#category-filter').value;
    const list = transactions.filter((tx) => tx.title.toLowerCase().includes(query) && (category === 'all' || tx.category === category));
    const sort = $('#sort-select').value;
    list.sort((a, b) => sort === 'date-asc' ? a.date.localeCompare(b.date) || a.id.localeCompare(b.id) : sort === 'amount-desc' ? b.amount - a.amount || b.date.localeCompare(a.date) : sort === 'amount-asc' ? a.amount - b.amount || b.date.localeCompare(a.date) : b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    return list;
  }
  function renderTransactions() {
    const list = filteredTransactions(); $('#transactions-body').innerHTML = list.map((tx) => transactionRow(tx, true)).join('');
    const isEmpty = list.length === 0; $('#transactions-empty').classList.toggle('hidden', !isEmpty);
    if (isEmpty) { const hasFilters = transactions.length > 0; $('#transactions-empty-title').textContent = hasFilters ? 'No matching expenses' : 'No transactions yet'; $('#transactions-empty-text').textContent = hasFilters ? 'Try a different search or category filter.' : 'Start by adding your first expense.'; $('#transactions-empty .button').classList.toggle('hidden', hasFilters); }
    $('#result-count').textContent = `Showing ${list.length} of ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`;
    $('#clear-btn').disabled = transactions.length === 0; $('#clear-btn').style.opacity = transactions.length ? '1' : '.5'; bindRowActions($('#transactions-body'));
  }
  function clearTransactions() {
    if (!transactions.length) return;
    if (!window.confirm(`Clear all ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}? This cannot be undone. Your budget setting will be kept.`)) return;
    const previous = transactions; transactions = []; if (!persistTransactions()) { transactions = previous; return; }
    renderAll(); showToast('All transactions cleared. Your budget was kept.');
  }

  function makeChart(key, canvasId, config) {
    if (typeof Chart === 'undefined') { const canvas = document.getElementById(canvasId); const fallback = canvas?.parentElement.querySelector('.chart-fallback'); if (fallback) fallback.classList.remove('hidden'); return; }
    if (chartInstances[key]) chartInstances[key].destroy(); const canvas = document.getElementById(canvasId); if (!canvas) return;
    chartInstances[key] = new Chart(canvas, config);
  }
  function chartDefaults() { return { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#263452', padding: 10, titleFont: { family: 'DM Sans', size: 10 }, bodyFont: { family: 'DM Sans', size: 10 }, displayColors: true } } }; }
  function makeDoughnut(key, id, list, totalId) {
    const totals = categoryTotals(list); const entries = CATEGORIES.filter((cat) => totals[cat] > 0); const values = entries.map((cat) => totals[cat]);
    if (totalId) $(totalId).textContent = shortMoney(list.reduce((sum, tx) => sum + tx.amount, 0));
    makeChart(key, id, { type: 'doughnut', data: { labels: entries.length ? entries : ['No expenses yet'], datasets: [{ data: entries.length ? values : [1], backgroundColor: entries.length ? entries.map(categoryColor) : ['#ececf2'], borderWidth: 0, hoverOffset: entries.length ? 5 : 0, spacing: entries.length ? 3 : 0, borderRadius: entries.length ? 4 : 0 }] }, options: { ...chartDefaults(), cutout: '76%', plugins: { ...chartDefaults().plugins, tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: (item) => `${item.label}: ${money(item.raw)}` }, filter: () => entries.length > 0 } } } });
  }
  function renderLegend(target, list, limit = 8) {
    const totals = categoryTotals(list); const entries = CATEGORIES.filter((cat) => totals[cat] > 0).sort((a, b) => totals[b] - totals[a]).slice(0, limit);
    $(target).innerHTML = entries.length ? entries.map((cat) => `<div class="legend-item"><span class="legend-dot" style="background:${categoryColor(cat)}"></span><span class="legend-name">${cat}</span><span class="legend-value">${shortMoney(totals[cat])}</span></div>`).join('') : '<div class="legend-item" style="grid-column:1/-1;color:#a0a6b5">No expenses to show yet</div>';
  }
  function renderCharts() {
    const months = monthlyTotals();
    const monthValues = months.map((month) => month.total);
    const currentIndex = months.length - 1;
    const trendConfig = {
      type: 'bar',
      data: {
        labels: months.map((month) => month.label),
        datasets: [{
          data: monthValues,
          backgroundColor: months.map((_, index) => index === currentIndex ? '#7867e8' : '#e6e2fb'),
          borderRadius: 5,
          maxBarThickness: 30
        }]
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#a0a6b4', font: { family: 'DM Sans', size: 9 } } },
          y: {
            beginAtZero: true,
            grid: { color: '#f0f1f5', drawTicks: false },
            border: { display: false, dash: [3, 4] },
            ticks: {
              color: '#a0a6b4', font: { family: 'DM Sans', size: 8 }, padding: 8, maxTicksLimit: 5,
              callback: (value) => value >= 1000 ? `₹${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : `₹${value}`
            }
          }
        }
      }
    };
    makeChart('trend', 'trendChart', trendConfig);
    makeChart('analyticsTrend', 'analyticsTrendChart', trendConfig);
    makeDoughnut('dashboardDoughnut', 'categoryChart', monthTransactions(), '#donut-total');
    makeDoughnut('analyticsDoughnut', 'analyticsCategoryChart', transactions, '#analytics-donut-total');

    const totals = categoryTotals(transactions);
    makeChart('categoryBar', 'categoryBarChart', {
      type: 'bar',
      data: {
        labels: CATEGORIES,
        datasets: [{ data: CATEGORIES.map((category) => totals[category]), backgroundColor: CATEGORIES.map((category) => `${categoryColor(category)}c9`), borderRadius: 4, maxBarThickness: 16 }]
      },
      options: {
        ...chartDefaults(),
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true, grid: { color: '#f0f1f5' }, border: { display: false },
            ticks: { color: '#a0a6b4', font: { family: 'DM Sans', size: 8 }, callback: (value) => value >= 1000 ? `₹${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : `₹${value}` }
          },
          y: { grid: { display: false }, border: { display: false }, ticks: { color: '#778097', font: { family: 'DM Sans', size: 9 } } }
        }
      }
    });
    renderLegend('#dashboard-legend', monthTransactions());
    renderLegend('#analytics-legend', transactions);
  }
  function renderBudget() {
    const spent = monthTransactions().reduce((sum, tx) => sum + tx.amount, 0); const pct = budget ? spent / budget * 100 : 0; const width = budget ? Math.min(pct, 100) : 0;
    $('#budget-input').value = budget || ''; $('#budget-spent').textContent = money(spent); $('#budget-limit').textContent = budget ? money(budget) : 'Not set';
    $('#budget-remaining').textContent = budget ? money(Math.max(0, budget - spent)) : '—'; $('#budget-utilization').textContent = budget ? `${Math.round(pct)}%` : '—';
    $('#budget-progress').style.width = `${width}%`; $('#budget-progress').classList.toggle('over-budget', !!budget && pct >= 100);
    const alert = $('#budget-alert'); alert.classList.add('hidden'); alert.classList.remove('danger');
    if (!budget) { $('#budget-status-title').textContent = 'Your spending, at a glance'; }
    else if (pct >= 100) { $('#budget-status-title').textContent = 'You’ve reached your monthly limit'; alert.textContent = `You are ${money(spent - budget)} over your budget. Consider reviewing your spending for the rest of the month.`; alert.classList.remove('hidden'); alert.classList.add('danger'); }
    else if (pct >= 80) { $('#budget-status-title').textContent = 'You’re getting close to your limit'; alert.textContent = `You’ve used ${Math.round(pct)}% of your budget, with ${money(budget - spent)} remaining.`; alert.classList.remove('hidden'); }
    else { $('#budget-status-title').textContent = 'You’re on track this month'; }
    $('#budget-summary-text').textContent = budget ? `${money(spent)} spent of your ${money(budget)} monthly limit.` : 'Set a monthly budget to keep your spending on track.';
    $('#budget-mini-label').textContent = budget ? `${Math.round(pct)}% used` : 'No budget set'; $('#budget-mini-amount').textContent = budget ? `${money(spent)} / ${money(budget)}` : '';
    $('#budget-mini-progress').style.width = `${width}%`; $('#budget-mini-progress').style.background = pct >= 100 ? 'linear-gradient(90deg,#f1ab72,#de6976)' : '';
  }
  function saveBudget(event) {
    event.preventDefault(); const input = $('#budget-input'); const value = Number(input.value); const error = $('#budget-error'); error.textContent = '';
    if (!Number.isFinite(value) || value <= 0 || value > 1e12) { error.textContent = 'Enter a monthly budget greater than 0 and no more than ₹1,000,000,000,000.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    input.removeAttribute('aria-invalid'); const isUpdate = budget !== null; if (!persistBudget(value)) return; budget = value; renderBudget(); showToast(isUpdate ? 'Monthly budget updated.' : 'Monthly budget saved.');
  }
  function exportCSV() {
    if (!transactions.length) { showToast('There are no transactions to export yet.', 'error'); return; }
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [['Title', 'Amount (INR)', 'Category', 'Date', 'Description'], ...[...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx) => [tx.title, tx.amount.toFixed(2), tx.category, tx.date, tx.description])];
    const csv = '\ufeff' + rows.map((row) => row.map(quote).join(',')).join('\r\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `spendwise-transactions-${todayLocal()}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('CSV export downloaded.');
  }
  function renderDashboard() {
    const total = transactions.reduce((sum, tx) => sum + tx.amount, 0); const current = monthTransactions(); const monthly = current.reduce((sum, tx) => sum + tx.amount, 0); const top = highestCategory(transactions); const now = new Date();
    $('#stat-total').textContent = money(total); $('#stat-month').textContent = money(monthly); $('#stat-count').textContent = String(transactions.length); $('#month-name').textContent = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(now);
    $('#stat-category').textContent = top?.[0] || '—'; $('#stat-category-sub').textContent = top ? `${money(top[1])} total spent` : 'Your biggest spend area'; $('#nav-count').textContent = String(transactions.length);
    const latest = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5);
    $('#recent-body').innerHTML = latest.map((tx) => transactionRow(tx)).join(''); $('#recent-empty').classList.toggle('hidden', latest.length > 0); $('#recent-body').closest('.table-wrap').classList.toggle('hidden', latest.length === 0);
    $('#analytics-month-total').textContent = money(monthly); $('#analytics-month-caption').textContent = `Across ${current.length} transaction${current.length === 1 ? '' : 's'}`;
    const topMonth = highestCategory(current); $('#analytics-top-category').textContent = topMonth?.[0] || '—'; $('#analytics-top-caption').textContent = topMonth ? `${money(topMonth[1])} this month` : 'No categories yet';
    $('#analytics-average').textContent = money(transactions.length ? total / transactions.length : 0);
    renderBudget(); renderCharts();
  }
  function renderAll() { renderDashboard(); renderTransactions(); }
  function initDate() {
    const now = new Date(); $('#year').textContent = String(now.getFullYear()); $('#today-label').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(now); $('#heading-date').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    $('#month-name').textContent = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(now);
  }
  function init() {
    initDate(); initNavigation(); initForm(); renderAll();
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) transactions = normalizeTransactions(loadJSON(STORAGE_KEY, []));
      if (event.key === BUDGET_KEY) { const value = loadJSON(BUDGET_KEY, null); budget = Number.isFinite(value) && value > 0 ? value : null; }
      renderAll();
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
