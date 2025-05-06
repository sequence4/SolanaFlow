CREATE TABLE IF NOT EXISTS waitlist (
  id               SERIAL PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  wallet_address   TEXT,
  full_name        TEXT,
  telegram_handle  TEXT,
  twitter_handle   TEXT,
  discord_username TEXT,
  referred_by      TEXT,
  source           TEXT,
  signup_ip        INET,
  meta             JSONB,
  consent          BOOLEAN NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
