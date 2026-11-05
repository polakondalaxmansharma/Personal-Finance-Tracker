require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { authRouter, requireAuth } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({ origin: ['http://127.0.0.1:5500', 'http://localhost:5500'] }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

function validMoney(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 &&
    value <= 99999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
function validCategory(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 50;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validateTransaction(data) {
  if (!data || !['income', 'expense'].includes(data.type)) return 'Choose income or expense';
  if (!validCategory(data.category)) return 'Enter a valid category (1–50 characters)';
  if (!validMoney(data.amount)) return 'Enter a positive amount with at most 2 decimal places';
  if (!validDate(data.date)) return 'Enter a valid date';
  return null;
}
function validId(value) { return Number.isSafeInteger(value) && value > 0; }
function failure(res, error, message) {
  console.error(message, error);
  res.status(500).json({ error: message });
}

app.get('/', (req, res) => res.json({ message: 'Finance Tracker Phase 6 API connected' }));

app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT transaction_id AS id, type, category, amount, transaction_date AS date
       FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, transaction_id DESC`,
      [req.user.userId]);
    res.json(rows);
  } catch (e) { failure(res, e, 'Failed to fetch transactions'); }
});

app.post('/api/transactions', async (req, res) => {
  const error = validateTransaction(req.body);
  if (error) return res.status(400).json({ error });
  const { type, category, amount, date } = req.body;
  try {
    const [result] = await db.execute(
      `INSERT INTO transactions (user_id, type, category, amount, transaction_date)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.userId, type, category.trim(), amount, date]);
    res.status(201).json({ id: result.insertId, type, category: category.trim(), amount, date });
  } catch (e) { failure(res, e, 'Failed to add transaction'); }
});

app.put('/api/transactions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid transaction ID' });
  const error = validateTransaction(req.body);
  if (error) return res.status(400).json({ error });
  const { type, category, amount, date } = req.body;
  try {
    const [result] = await db.execute(
      `UPDATE transactions SET type=?, category=?, amount=?, transaction_date=?
       WHERE transaction_id=? AND user_id=?`,
      [type, category.trim(), amount, date, id, req.user.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction updated successfully' });
  } catch (e) { failure(res, e, 'Failed to update transaction'); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid transaction ID' });
  try {
    const [result] = await db.execute(
      'DELETE FROM transactions WHERE transaction_id=? AND user_id=?', [id, req.user.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction deleted successfully' });
  } catch (e) { failure(res, e, 'Failed to delete transaction'); }
});

app.get('/api/summary', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS totalIncome,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS totalExpenses
       FROM transactions WHERE user_id=?`, [req.user.userId]);
    const totalIncome = Number(rows[0].totalIncome);
    const totalExpenses = Number(rows[0].totalExpenses);
    res.json({ totalIncome, totalExpenses, balance: totalIncome - totalExpenses });
  } catch (e) { failure(res, e, 'Failed to fetch summary'); }
});

app.get('/api/monthly-report', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT DATE_FORMAT(transaction_date,'%Y-%m') AS month,
              SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses
       FROM transactions WHERE user_id=?
       GROUP BY DATE_FORMAT(transaction_date,'%Y-%m') ORDER BY month ASC`, [req.user.userId]);
    res.json(rows);
  } catch (e) { failure(res, e, 'Failed to fetch monthly report'); }
});

app.get('/api/category-report', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT category, SUM(amount) AS total FROM transactions
       WHERE user_id=? AND type='expense' GROUP BY category ORDER BY total DESC`, [req.user.userId]);
    res.json(rows);
  } catch (e) { failure(res, e, 'Failed to fetch category report'); }
});

app.get('/api/budgets', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT budget_id, category, monthly_limit, month, year FROM budgets
       WHERE user_id=? ORDER BY year DESC, month DESC, category`, [req.user.userId]);
    res.json(rows);
  } catch (e) { failure(res, e, 'Failed to fetch budgets'); }
});

app.post('/api/budgets', async (req, res) => {
  const { category, monthly_limit, month, year } = req.body || {};
  const amount = Number(monthly_limit), m = Number(month), y = Number(year);
  if (!validCategory(category) || monthly_limit === null || monthly_limit === '' ||
      typeof monthly_limit === 'boolean' || !validMoney(amount) ||
      !Number.isInteger(m) || m < 1 || m > 12 ||
      !Number.isInteger(y) || y < 2000 || y > 2100) {
    return res.status(400).json({ error: 'Invalid budget details' });
  }
  try {
    const [result] = await db.execute(
      `INSERT INTO budgets (user_id, category, monthly_limit, month, year)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_limit=VALUES(monthly_limit)`,
      [req.user.userId, category.trim(), amount, m, y]);
    res.json({ message: 'Budget saved successfully', budget_id: result.insertId || null });
  } catch (e) { failure(res, e, 'Failed to save budget'); }
});

app.get('/api/budget-alerts', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT b.category, b.month, b.year, b.monthly_limit,
              COALESCE(SUM(t.amount),0) AS spent
       FROM budgets b LEFT JOIN transactions t
         ON t.user_id=b.user_id AND t.type='expense' AND t.category=b.category
         AND MONTH(t.transaction_date)=b.month AND YEAR(t.transaction_date)=b.year
       WHERE b.user_id=?
       GROUP BY b.budget_id, b.category, b.month, b.year, b.monthly_limit
       ORDER BY b.year DESC, b.month DESC, b.category`, [req.user.userId]);
    res.json(rows.map(row => ({
      category: row.category, month: row.month, year: row.year,
      monthly_limit: Number(row.monthly_limit), spent: Number(row.spent),
      exceeded: Number(row.spent) > Number(row.monthly_limit)
    })));
  } catch (e) { failure(res, e, 'Failed to fetch budget alerts'); }
});

async function startServer() {
  try {
    const connection = await db.getConnection();
    connection.release();
    console.log('MySQL connected successfully');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
}
startServer();
