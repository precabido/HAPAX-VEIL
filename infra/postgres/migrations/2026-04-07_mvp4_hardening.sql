ALTER TABLE secrets
  ADD COLUMN IF NOT EXISTS manage_token_hash text;

CREATE INDEX IF NOT EXISTS idx_secrets_manage_token_hash
  ON secrets (manage_token_hash)
  WHERE manage_token_hash IS NOT NULL;

