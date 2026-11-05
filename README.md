# Personal Finance Tracker — Phase 6

This package is based on the **five files you uploaded** (HTML, JS, CSS, server.js, and .env). The frontend layout and Phase 5 functionality were retained. `db.js` and `schema.sql` were taken from the earlier Phase 5 project archive because they were not among the five new uploads. The `.env` containing your database password is **not included**.

## Included
- Phase 5: transactions (create/edit/delete), summary, expense and monthly charts, filters, budgets, budget alerts, CSV export
- Phase 6: register/login, bcrypt password hashing, JWT authentication, rate limiting, user-specific transaction and budget APIs, logout, session restoration

## Setup on Windows
1. Extract ZIP and open `Personal-Finance-Tracker-Phase6` in VS Code.
2. In MySQL Workbench, run `database/schema.sql` if your database/tables do not exist. It uses `CREATE TABLE IF NOT EXISTS` and does not delete existing rows.
3. Open a terminal: `cd backend` then `npm install`.
4. Copy `backend/.env.example` to `backend/.env`. Enter your own MySQL password, and replace JWT_SECRET with a long, random, unique secret (at least 32 characters). Do not publish `.env`.
5. Run `node server.js` (or `npm start`); wait for `MySQL connected successfully` and `Server running at http://localhost:5000`.
6. In VS Code use **Live Server** to open `frontend/index.html` at `http://127.0.0.1:5500/frontend/index.html` (or the matching Live Server URL). Do not open the HTML as a file:// URL.
7. Select **Register**, create a new account, then **Login**. Your dashboard initially shows no transactions or budgets because data is now separated by user account.
8. Add a transaction and budget; refresh the page to confirm they persist. Log out, log in, and verify again.

## Important about older Phase 5 data
Your Phase 5 server used `DEMO_USER_ID=1`. Phase 6 intentionally removes this shared demo identity. Existing transactions and budgets linked to user 1 will **not** automatically appear in a newly registered account. This is expected and prevents one user from seeing another user's data. Do not transfer ownership blindly; if you need to migrate existing records, make a database backup and verify the intended owner first.

## Troubleshooting
- `Cannot find module 'express-rate-limit'`: run `npm install` inside `backend`.
- `Access denied for user ...`: check DB_USER and DB_PASSWORD in backend/.env.
- `Unexpected token '<'`: confirm backend runs at port 5000 and the API path returns JSON, not HTML.
- Login button refreshes page: confirm `frontend/script.js` loads, then check browser F12 Console.
- `Session invalid or expired`: log in again (tokens expire after two hours).

## Security
This is a **local-development** project. `sessionStorage` tokens are browser-readable and can be exposed by XSS; a production deployment should use secure HttpOnly cookies with CSRF protection, stronger deployment controls, and HTTPS. Do not expose this local demo as a public finance service without a full security review. Because your `.env` was uploaded to chat, **change the database password** before deploying or sharing.
