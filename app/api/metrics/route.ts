import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { subHours, subDays, subMinutes } from 'date-fns';

/**
 * GET /api/metrics
 *
 * Métricas de performance y uso del sistema
 * Útil para dashboards de monitoreo y análisis
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const includeSystemMetrics = request.headers.get('x-admin') === 'true';

    const now = new Date();
    const last24h = subHours(now, 24);
    const last7d = subDays(now, 7);
    const last30d = subDays(now, 30);

    // Métricas del tenant (si está especificado)
    let tenantMetrics = null;
    if (tenantId) {
      const [
        totalDocuments,
        documents24h,
        documents7d,
        completedDocuments,
        failedDocuments,
        processingDocuments,
        avgProcessingTime,
      ] = await Promise.all([
        // Total de documentos
        prisma.document.count({ where: { tenantId } }),

        // Documentos últimas 24 horas
        prisma.document.count({
          where: { tenantId, createdAt: { gte: last24h } },
        }),

        // Documentos últimos 7 días
        prisma.document.count({
          where: { tenantId, createdAt: { gte: last7d } },
        }),

        // Documentos completados
        prisma.document.count({
          where: { tenantId, status: 'COMPLETED' },
        }),

        // Documentos fallidos
        prisma.document.count({
          where: { tenantId, status: 'FAILED' },
        }),

        // Documentos en proceso
        prisma.document.count({
          where: {
            tenantId,
            status: { in: ['QUEUED', 'PROCESSING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING'] },
          },
        }),

        // Tiempo promedio de procesamiento (solo documentos completados)
        prisma.document.aggregate({
          where: {
            tenantId,
            status: 'COMPLETED',
            createdAt: { gte: last7d },
          },
          _avg: {
            processingTime: true,
          },
        }),
      ]);

      // Calcular tasas
      const successRate =
        totalDocuments > 0 ? ((completedDocuments / totalDocuments) * 100).toFixed(2) : '0';
      const failureRate =
        totalDocuments > 0 ? ((failedDocuments / totalDocuments) * 100).toFixed(2) : '0';

      tenantMetrics = {
        documents: {
          total: totalDocuments,
          last24h: documents24h,
          last7d: documents7d,
          completed: completedDocuments,
          failed: failedDocuments,
          processing: processingDocuments,
        },
        performance: {
          avgProcessingTime: avgProcessingTime._avg.processingTime || 0,
          successRate: parseFloat(successRate),
          failureRate: parseFloat(failureRate),
        },
      };
    }

    // Métricas del sistema (solo para admins)
    let systemMetrics = null;
    if (includeSystemMetrics) {
      const [
        totalTenants,
        activeTenants,
        totalUsers,
        totalDocumentsSystem,
        documentsLast24hSystem,
        memoryUsage,
      ] = await Promise.all([
        // Total de tenants
        prisma.tenant.count(),

        // Tenants activos (con documentos en los últimos 30 días)
        prisma.tenant.count({
          where: {
            documents: {
              some: {
                createdAt: { gte: last30d },
              },
            },
          },
        }),

        // Total de usuarios
        prisma.user.count(),

        // Total de documentos en el sistema
        prisma.document.count(),

        // Documentos últimas 24 horas (sistema)
        prisma.document.count({
          where: { createdAt: { gte: last24h } },
        }),

        // Uso de memoria
        Promise.resolve(process.memoryUsage()),
      ]);

      // Calcular throughput (docs por hora)
      const throughput = (documentsLast24hSystem / 24).toFixed(2);

      systemMetrics = {
        tenants: {
          total: totalTenants,
          active: activeTenants,
        },
        users: {
          total: totalUsers,
        },
        documents: {
          total: totalDocumentsSystem,
          last24h: documentsLast24hSystem,
          throughput: parseFloat(throughput),
        },
        system: {
          uptime: process.uptime(),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          },
          nodeVersion: process.version,
          platform: process.platform,
        },
      };
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      tenant: tenantMetrics,
      system: systemMetrics,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 });
  }
}

/**
 * POST /api/metrics
 *
 * Registrar métrica custom (para tracking de eventos)
 */
export async function POST(request: NextRequest) {
  try {
    const { event, properties } = await request.json();

    if (!event) {
      return NextResponse.json({ error: 'Event name requerido' }, { status: 400 });
    }

    // Aquí podrías guardar en base de datos o enviar a un servicio de analytics
    // Por ahora solo logueamos
    console.log('[METRIC]', event, properties);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording metric:', error);
    return NextResponse.json({ error: 'Error al registrar métrica' }, { status: 500 });
  }
}
