CREATE TABLE IF NOT EXISTS sms_settings (
 institution_id TEXT PRIMARY KEY,
 username TEXT NOT NULL,
 sender_id TEXT NOT NULL DEFAULT '',
 enabled INTEGER NOT NULL DEFAULT 0,
 iv TEXT NOT NULL,
 credentials TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sms_delivery_log (
 idempotency_key TEXT PRIMARY KEY,
 institution_id TEXT NOT NULL,
 session_id TEXT NOT NULL,
 student_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 phone_masked TEXT NOT NULL,
 status TEXT NOT NULL,
 provider_message_id TEXT,
 provider_response TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_institution_created ON sms_delivery_log(institution_id,created_at DESC);
