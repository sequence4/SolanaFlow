-- Stores one encrypted vendor key per user & provider
CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id      UUID      REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT      NOT NULL,
  key_cipher   BYTEA     NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

-- Fast look-ups by provider
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider
    ON user_api_keys (provider);

-- Optional partial index for quick existence checks, if you expect mostly-empty rows:
-- CREATE UNIQUE INDEX user_api_keys_user_provider_uniq
--     ON user_api_keys (user_id, provider)
--     WHERE key_cipher IS NOT NULL; 