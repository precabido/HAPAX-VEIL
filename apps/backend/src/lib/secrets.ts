import { pool } from './db.js';

let intervalHandle: NodeJS.Timeout | null = null;

export async function runCleanupOnce(): Promise<void> {
  await pool.query(`
    UPDATE secrets
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at <= NOW()
  `);

  await pool.query(`
    DELETE FROM secrets
    WHERE
      (
        status = 'expired'
        AND expires_at <= NOW() - INTERVAL '7 days'
      )
      OR (
        status IN ('burned', 'revoked')
        AND updated_at <= NOW() - INTERVAL '7 days'
      )
  `);
}

export function startCleanupLoop(): void {
  if (intervalHandle) return;

  intervalHandle = setInterval(() => {
    runCleanupOnce().catch((error) => {
      console.error('[cleanup] failed', error);
    });
  }, 60_000);
}