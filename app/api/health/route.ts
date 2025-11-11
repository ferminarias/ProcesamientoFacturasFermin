import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import Redis from 'ioredis';

/**
 * GET /api/health
 *
 * Health check endpoint para monitoreo de uptime
 * Verifica conexión a base de datos, Redis y servicios críticos
 */
export async function GET() {
  const startTime = Date.now();

  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: { status: 'unknown' as 'ok' | 'error' | 'unknown', responseTime: 0 },
      redis: { status: 'unknown' as 'ok' | 'error' | 'unknown', responseTime: 0 },
      openai: { status: 'unknown' as 'ok' | 'error' | 'unknown', configured: false },
    },
    responseTime: 0,
  };

  // Check Database (Prisma)
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database.status = 'ok';
    health.checks.database.responseTime = Date.now() - dbStart;
  } catch (error) {
    health.checks.database.status = 'error';
    health.status = 'unhealthy';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });

    await redis.ping();
    health.checks.redis.status = 'ok';
    health.checks.redis.responseTime = Date.now() - redisStart;

    redis.disconnect();
  } catch (error) {
    health.checks.redis.status = 'error';
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  // Check OpenAI (solo verificar si está configurado)
  health.checks.openai.configured = !!process.env.OPENAI_API_KEY;
  health.checks.openai.status = health.checks.openai.configured ? 'ok' : 'error';

  // Calcular tiempo de respuesta total
  health.responseTime = Date.now() - startTime;

  // Determinar status HTTP según health
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
