import { NextRequest, NextResponse } from 'next/server';
import { validateTenant } from '@/lib/middleware/tenant.middleware';
import { prisma } from '@/lib/database/prisma.client';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateTenant(request);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const tenantId = validation.tenantId!;

    const automations = await prisma.automation.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ automations });
  } catch (error) {
    console.error('Error fetching automations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateTenant(request);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const tenantId = validation.tenantId!;
    const body = await request.json();
    const { name, description, trigger, actions, enabled = true } = body;

    if (!name || !trigger || !actions || !Array.isArray(actions)) {
      return NextResponse.json(
        { error: 'name, trigger, and actions are required' },
        { status: 400 }
      );
    }

    const automation = await prisma.automation.create({
      data: {
        tenantId,
        name,
        description,
        trigger,
        actions,
        enabled,
      },
    });

    return NextResponse.json({ automation });
  } catch (error) {
    console.error('Error creating automation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
