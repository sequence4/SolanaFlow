CREATE DATABASE solanaflow;

\connect solanaflow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS waitlist (
    id            UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         CITEXT NOT NULL UNIQUE,
    full_name     TEXT,
    signup_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referral_code UUID UNIQUE      DEFAULT uuid_generate_v4(),
    referred_by   UUID REFERENCES waitlist(id) ON DELETE SET NULL,
    ip_address    INET,
    meta          JSONB
);

CREATE INDEX IF NOT EXISTS idx_waitlist_signup_at ON waitlist (signup_at);
