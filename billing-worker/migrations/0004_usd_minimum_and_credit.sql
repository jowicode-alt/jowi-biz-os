ALTER TABLE subscriptions ADD COLUMN usd_credit REAL NOT NULL DEFAULT 0;
ALTER TABLE billing_transactions ADD COLUMN credit_used_usd REAL NOT NULL DEFAULT 0;
