CREATE DATABASE IF NOT EXISTS personal_finance_tracker;
USE personal_finance_tracker;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  type ENUM('income', 'expense') NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  description VARCHAR(255),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_transaction_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS budgets (
  budget_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category VARCHAR(50) NOT NULL,
  monthly_limit DECIMAL(10,2) NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_budget_amount CHECK (monthly_limit > 0),
  CONSTRAINT chk_budget_month CHECK (month BETWEEN 1 AND 12),
  UNIQUE KEY uq_budget_user_category_month_year (user_id, category, month, year)
);

-- Local Phase 5 demonstration user. No login is provided in this phase.
-- Never use this shared demo setup for publicly accessible financial data.
INSERT INTO users (user_id, name, email, password_hash)
VALUES (1, 'Demo User', 'phase5-demo@example.invalid', 'NO_LOGIN_PHASE5')
ON DUPLICATE KEY UPDATE user_id = user_id;
