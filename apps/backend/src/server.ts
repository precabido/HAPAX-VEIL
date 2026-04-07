import { buildApp } from './app.js';
import { runCleanupOnce, startCleanupLoop } from './lib/cleanup.js';

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  await runCleanupOnce();

  const app = buildApp();

  try {
    await app.listen({ port, host });
    startCleanupLoop();
    app.log.info(`backend listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();