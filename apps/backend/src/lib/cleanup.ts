import { query } from './db.js';

let cleanupStarted = false;
let lastCleanupErrorAt = 0;

export async function runCleanupOnce(): Promise<void> {
  await query(
    `
    DELETE FROM secrets
    WHERE status <> 'active'
       OR expires_at <= NOW()
       OR remaining_reads <= 0
    `
  );
}

export function startCleanupLoop(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const intervalMs = Number(process.env.CLEANUP_INTERVAL_MS || 60_000);
  const firstRunDelayMs = Number(process.env.CLEANUP_FIRST_DELAY_MS || 15_000);

  const runSafe = async () => {
    try {
      await runCleanupOnce();
    } catch (error) {
      const now = Date.now();
      if (now - lastCleanupErrorAt > 60_000) {
        lastCleanupErrorAt = now;
        console.error('[cleanup] failed', error);
      }
    }
  };

  setTimeout(() => {
    void runSafe();
    setInterval(() => {
      void runSafe();
    }, intervalMs);
  }, firstRunDelayMs);
}

