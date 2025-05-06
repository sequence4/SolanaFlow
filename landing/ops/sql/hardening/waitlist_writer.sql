CREATE ROLE waitlist_writer
  LOGIN
  PASSWORD '<STRONG-32CHAR-PW>'
  CONNECTION LIMIT 15;

GRANT USAGE ON SCHEMA public TO waitlist_writer;
GRANT INSERT ON TABLE waitlist TO waitlist_writer;

ALTER TABLE waitlist
  ADD CONSTRAINT chk_wallet_format
    CHECK (
      wallet_address IS NULL
      OR wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    ); 