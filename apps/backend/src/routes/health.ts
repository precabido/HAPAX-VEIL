import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      ok: true,
      service: 'api',
      timestamp: new Date().toISOString()
    };
  });
}