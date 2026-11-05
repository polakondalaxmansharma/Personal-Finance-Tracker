'use strict';
const API_URL = 'http://localhost:5000/api';
let authToken = sessionStorage.getItem('authToken');
const $ = id => document.getElementById(id);
let transactions = [];
let editingId = null;
let expenseChart = null;
let monthlyChart = null;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value) || 0);
const today = () => new Date().toLocaleDateString('en-CA');
function showMessage(message, isError = false) {
  $('statusMessage').textContent = message;
  $('statusMessage').classList.toggle('error', isError);
}
async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(API_URL + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...options.headers }
    });
  } catch (_) {
    throw new Error('Cannot connect to backend. Start node server.js in the backend folder.');
  }
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error(`Unexpected response from ${path}. Check backend URL.`);
  const data = await response.json();
  if (response.status === 401 && !path.startsWith('/auth/')) { signOut('Session expired. Please log in again.'); }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function buildChart(canvas, kind, labels, datasets, existing) {
  if (existing) existing.destroy();
  if (typeof Chart === 'undefined') return null;
  return new Chart(canvas, {
    type: kind,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      ...(kind === 'bar' ? { scales: { y: { beginAtZero: true } } } : {})
    }
  });
}
function renderTransactions() {
  const category = $('categoryFilter').value;
  const month = $('monthFilter').value;
  const visible = transactions.filter(t =>
    (category === 'all' || t.category === category) &&
    (!month || String(t.date).slice(0, 7) === month)
  );
  const tbody = $('transactionList');
  tbody.replaceChildren();
  if (!visible.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No transactions found.';
    tr.append(td); tbody.append(tr);
    return;
  }
  visible.forEach(t => {
    const tr = document.createElement('tr');
    [t.date, t.category, t.type, money(t.amount)].forEach(value => {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    });
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => openEdit(t));
    const del = document.createElement('button');
    del.type = 'button'; del.textContent = 'Delete'; del.className = 'danger-btn';
    del.addEventListener('click', () => deleteTransaction(t.id));
    actions.append(edit, del); tr.append(actions); tbody.append(tr);
  });
}
function updateCategoryFilter() {
  const select = $('categoryFilter');
  const selected = select.value;
  select.replaceChildren(new Option('All Categories', 'all'));
  [...new Set(transactions.map(t => t.category))].sort().forEach(cat => select.add(new Option(cat, cat)));
  select.value = [...select.options].some(o => o.value === selected) ? selected : 'all';
}
async function loadTransactions() {
  transactions = await apiRequest('/transactions');
  updateCategoryFilter();
  renderTransactions();
}
async function loadSummary() {
  const summary = await apiRequest('/summary');
  $('income').textContent = money(summary.totalIncome);
  $('expenses').textContent = money(summary.totalExpenses);
  $('balance').textContent = money(summary.balance);
}
async function loadCategoryReport() {
  const rows = await apiRequest('/category-report');
  expenseChart = buildChart($('expenseChart'), 'doughnut', rows.map(r => r.category), [
    { label: 'Expenses', data: rows.map(r => Number(r.total)), backgroundColor: ['#2563eb','#16a34a','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'] }
  ], expenseChart);
}
async function loadMonthlyReport() {
  const rows = await apiRequest('/monthly-report');
  monthlyChart = buildChart($('monthlyChart'), 'bar', rows.map(r => r.month), [
    { label: 'Income', data: rows.map(r => Number(r.income)), backgroundColor: '#16a34a' },
    { label: 'Expenses', data: rows.map(r => Number(r.expenses)), backgroundColor: '#dc2626' }
  ], monthlyChart);
}
async function loadBudgets() {
  const budgets = await apiRequest('/budgets');
  const root = $('budgetList'); root.replaceChildren();
  if (!budgets.length) { root.textContent = 'No budgets saved yet.'; return; }
  budgets.forEach(b => {
    const item = document.createElement('div'); item.className = 'budget-item';
    item.textContent = `${b.category} • ${String(b.month).padStart(2,'0')}/${b.year} • Limit: ${money(b.monthly_limit)}`;
    root.append(item);
  });
}
async function loadBudgetAlerts() {
  const alerts = await apiRequest('/budget-alerts');
  const root = $('budgetAlerts'); root.replaceChildren();
  if (!alerts.length) { root.textContent = 'No budget alerts yet. Set a budget to begin.'; return; }
  alerts.forEach(a => {
    const item = document.createElement('div');
    item.className = `alert-item ${a.exceeded ? 'warning' : 'ok'}`;
    item.textContent = `${a.category} (${String(a.month).padStart(2,'0')}/${a.year}): Spent ${money(a.spent)} of ${money(a.monthly_limit)} — ${a.exceeded ? 'Budget exceeded!' : 'Within budget'}`;
    root.append(item);
  });
}
async function refreshDashboard() {
  const tasks = [loadTransactions(), loadSummary(), loadCategoryReport(), loadMonthlyReport(), loadBudgets(), loadBudgetAlerts()];
  const results = await Promise.allSettled(tasks);
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    failed.forEach(r => console.error(r.reason));
    showMessage(failed[0].reason.message || 'Some dashboard data failed to load.', true);
  } else showMessage('Dashboard updated successfully.');
}
function openEdit(t) {
  editingId = t.id;
  $('formTitle').textContent = 'Edit Transaction';
  $('saveBtn').textContent = 'Update Transaction';
  $('type').value = t.type;
  $('category').value = t.category;
  $('amount').value = t.amount;
  $('date').value = String(t.date).slice(0, 10);
  $('transactionDialog').showModal();
}
async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
    await refreshDashboard();
    showMessage('Transaction deleted successfully.');
  } catch (e) { showMessage(e.message, true); }
}
$('addBtn').addEventListener('click', () => {
  editingId = null;
  $('transactionForm').reset();
  $('date').value = today();
  $('formTitle').textContent = 'Add Transaction';
  $('saveBtn').textContent = 'Save Transaction';
  $('transactionDialog').showModal();
});
$('cancelBtn').addEventListener('click', () => $('transactionDialog').close());
$('transactionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    type: $('type').value,
    category: $('category').value.trim(),
    amount: Number($('amount').value),
    date: $('date').value
  };
  try {
    const path = editingId ? `/transactions/${editingId}` : '/transactions';
    await apiRequest(path, { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('transactionDialog').close();
    await refreshDashboard();
    showMessage(editingId ? 'Transaction updated successfully.' : 'Transaction added successfully.');
  } catch (e) { showMessage(e.message, true); }
});
$('budgetForm').addEventListener('submit', async event => {
  event.preventDefault();
  const selectedMonth = $('budgetMonth').value;
  if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return showMessage('Choose a valid budget month.', true);
  const [year, month] = selectedMonth.split('-').map(Number);
  const budget = { category: $('budgetCategory').value.trim(), monthly_limit: Number($('budgetAmount').value), month, year };
  try {
    await apiRequest('/budgets', { method: 'POST', body: JSON.stringify(budget) });
    $('budgetForm').reset(); $('budgetMonth').value = today().slice(0,7);
    await Promise.all([loadBudgets(), loadBudgetAlerts()]);
    showMessage('Budget saved successfully.');
  } catch (e) { showMessage(e.message, true); }
});
$('categoryFilter').addEventListener('change', renderTransactions);
$('monthFilter').addEventListener('change', renderTransactions);
$('clearFilters').addEventListener('click', () => {
  $('categoryFilter').value = 'all'; $('monthFilter').value = ''; renderTransactions();
});
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
$('exportCSV').addEventListener('click', () => {
  const rows = [['Date','Category','Type','Amount'], ...transactions.map(t => [t.date, t.category, t.type, t.amount])];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'Finance_Transactions.csv';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMessage('CSV exported successfully.');
});
$('budgetMonth').value = today().slice(0,7);

function showDashboard(user) {
  $('authSection').hidden = true;
  $('appContainer').hidden = false;
  $('welcomeUser').textContent = `Welcome, ${user.name}`;
  $('authMessage').textContent = '';
}
function signOut(message = '') {
  authToken = null;
  sessionStorage.removeItem('authToken');
  $('appContainer').hidden = true;
  $('authSection').hidden = false;
  $('authMessage').textContent = message;
  $('authMessage').classList.remove('ok');
  $('loginPassword').value = '';
  transactions = [];
  if (expenseChart) { expenseChart.destroy(); expenseChart = null; }
  if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }
}
function setAuthMode(mode) {
  const login = mode === 'login';
  $('loginForm').hidden = !login;
  $('registerForm').hidden = login;
  $('showLogin').className = login ? 'active' : 'secondary';
  $('showRegister').className = login ? 'secondary' : 'active';
  $('authMessage').textContent = '';
}
$('showLogin').addEventListener('click', () => setAuthMode('login'));
$('showRegister').addEventListener('click', () => setAuthMode('register'));
$('logoutBtn').addEventListener('click', () => signOut('You have logged out.'));
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('loginBtn'); button.disabled = true;
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('loginEmail').value.trim(), password: $('loginPassword').value })
    });
    if (!data.token || !data.user) throw new Error('Invalid login response from server.');
    authToken = data.token;
    sessionStorage.setItem('authToken', authToken);
    $('loginPassword').value = '';
    showDashboard(data.user);
    await refreshDashboard();
  } catch (error) { $('authMessage').textContent = error.message; }
  finally { button.disabled = false; }
});
$('registerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('registerBtn'); button.disabled = true;
  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: $('registerName').value.trim(), email: $('registerEmail').value.trim(), password: $('registerPassword').value })
    });
    $('loginEmail').value = $('registerEmail').value.trim();
    $('registerForm').reset();
    setAuthMode('login');
    $('authMessage').textContent = 'Account created. Log in with your new credentials.';
    $('authMessage').classList.add('ok');
  } catch (error) { $('authMessage').textContent = error.message; $('authMessage').classList.remove('ok'); }
  finally { button.disabled = false; }
});
(async function initialize() {
  if (!authToken) return;
  try {
    const result = await apiRequest('/auth/me');
    showDashboard(result.user);
    await refreshDashboard();
  } catch (error) { signOut('Please log in to continue.'); }
})();

