CREATE DATABASE solanaflow;
\connect solanaflow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS waitlist (
  id             UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          CITEXT UNIQUE,
  wallet_address VARCHAR(64),
  full_name      TEXT,
  telegram_handle  VARCHAR(32),
  twitter_handle   VARCHAR(32),
  discord_username VARCHAR(37),
  signup_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referral_code  UUID UNIQUE      DEFAULT uuid_generate_v4(),
  referred_by    UUID REFERENCES waitlist(id) ON DELETE SET NULL,
  source         TEXT,
  signup_ip      INET,
  meta           JSONB,
  CONSTRAINT chk_contact
    CHECK (email IS NOT NULL OR wallet_address IS NOT NULL)
);

CREATE INDEX idx_waitlist_signup_at ON waitlist (signup_at);
CREATE INDEX idx_waitlist_wallet    ON waitlist (wallet_address);
