ALTER TABLE secrets
  ADD COLUMN IF NOT EXISTS auth_fail_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auth_max_attempts integer NOT NULL DEFAULT 3;

UPDATE secrets
SET
  auth_fail_count = COALESCE(auth_fail_count, 0),
  auth_max_attempts = COALESCE(auth_max_attempts, 3);

ALTER TABLE secrets
  ALTER COLUMN auth_fail_count SET DEFAULT 0,
  ALTER COLUMN auth_max_attempts SET DEFAULT 3;