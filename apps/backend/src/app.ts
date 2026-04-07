import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health.js';
import { secretRoutes } from './routes/secrets.js';

export function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 100 * 1024 * 1024
  });

  app.register(sensible);

  app.register(cors, {
    origin: false
  });

  app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: (_req, key) => key === '127.0.0.1'
  });

  app.register(healthRoutes, { prefix: '/api' });
  app.register(secretRoutes, { prefix: '/api' });

  return app;
}

