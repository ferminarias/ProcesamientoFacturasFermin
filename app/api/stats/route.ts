import { NextRequest, NextResponse } from 'next/server';
import { validateTenant } from '@/lib/middleware/tenant.middleware';
import { prisma } from '@/lib/database/prisma.client';
import { subDays, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateTenant(request);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const tenantId = validation.tenantId!;

    // KPIs
    const [total, completed, processing, failed] = await Promise.all([
      prisma.document.count({ where: { tenantId } }),
      prisma.document.count({
        where: { tenantId, status: 'COMPLETED' },
      }),
      prisma.document.count({
        where: {
          tenantId,
          status: { in: ['QUEUED', 'PROCESSING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING'] },
        },
      }),
      prisma.document.count({
        where: { tenantId, status: 'FAILED' },
      }),
    ]);

    // Documents by type
    const byTypeRaw = await prisma.document.groupBy({
      by: ['classification'],
      where: {
        tenantId,
        classification: { not: null },
      },
      _count: true,
    });

    const byType = byTypeRaw.map((item) => ({
      type: (item.classification as any)?.type || 'Unknown',
      count: item._count,
    }));

    // Documents by status
    const byStatusRaw = await prisma.document.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    const byStatus = byStatusRaw.map((item) => ({
      name: item.status,
      count: item._count,
    }));

    // Trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'yyyy-MM-dd'),
        displayDate: format(date, 'dd/MM'),
      };
    });

    const trendData = await Promise.all(
      last7Days.map(async ({ date, displayDate }) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await prisma.document.count({
          where: {
            tenantId,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        return {
          date: displayDate,
          count,
        };
      })
    );

    return NextResponse.json({
      kpis: {
        total,
        completed,
        processing,
        failed,
      },
      byType,
      byStatus,
      trend: trendData,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
