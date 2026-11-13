CREATE TABLE IF NOT EXISTS subscriptions (
  institution_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  trial_started_at INTEGER,
  trial_ends_at INTEGER,
  period_started_at INTEGER,
  paid_through INTEGER,
  paid_student_count INTEGER NOT NULL DEFAULT 0,
  last_payment_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_transactions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  external_order_id TEXT NOT NULL UNIQUE,
  reference TEXT,
  payment_url TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX',
  student_count INTEGER NOT NULL,
  seat_count INTEGER NOT NULL,
  billing_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS billing_transactions_institution_created ON billing_transactions(institution_id,created_at DESC);
CREATE TABLE IF NOT EXISTS seat_grace_batches (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  seat_count INTEGER NOT NULL,
  grace_started_at INTEGER NOT NULL,
  grace_ends_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS seat_grace_batches_institution_status ON seat_grace_batches(institution_id,status);
CREATE TABLE IF NOT EXISTS webhook_events (
  delivery_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  received_at INTEGER NOT NULL
);