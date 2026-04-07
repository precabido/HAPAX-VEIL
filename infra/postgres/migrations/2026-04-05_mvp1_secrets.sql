CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'secret_status'
  ) THEN
    CREATE TYPE secret_status AS ENUM (
      'active',
      'burned',
      'expired',
      'revoked'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  status secret_status NOT NULL DEFAULT 'active',

  max_reads INTEGER NOT NULL DEFAULT 1 CHECK (max_reads >= 1),
  remaining_reads INTEGER NOT NULL DEFAULT 1 CHECK (remaining_reads >= 0),

  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  burned_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_opened_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_secrets_status_expires_at
  ON secrets (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_secrets_created_at
  ON secrets (created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_secrets_updated_at ON secrets;

CREATE TRIGGER trg_secrets_updated_at
BEFORE UPDATE ON secrets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();