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

    const integrations = await prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose tokens
      },
    });

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('Error fetching integrations:', error);
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
    const { provider, accessToken, refreshToken } = body;

    if (!provider || !accessToken) {
      return NextResponse.json(
        { error: 'provider and accessToken are required' },
        { status: 400 }
      );
    }

    // Deactivate existing integration of same provider
    await prisma.integration.updateMany({
      where: {
        tenantId,
        provider,
      },
      data: {
        isActive: false,
      },
    });

    // Create new integration
    const integration = await prisma.integration.create({
      data: {
        tenantId,
        provider,
        accessToken,
        refreshToken,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ integration });
  } catch (error) {
    console.error('Error creating integration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const validation = await validateTenant(request);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const tenantId = validation.tenantId!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await prisma.integration.delete({
      where: {
        id,
        tenantId, // Ensure tenant owns this integration
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
