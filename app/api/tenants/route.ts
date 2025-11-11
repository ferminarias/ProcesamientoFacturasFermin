import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * POST /api/tenants
 * Crea un nuevo tenant (solo para administradores del sistema)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, subdomain, customDomain, plan, ownerEmail, ownerName } = body

    if (!name || !slug || !ownerEmail) {
      return NextResponse.json(
        { error: 'name, slug y ownerEmail son requeridos' },
        { status: 400 }
      )
    }

    // Verificar que el slug no existe
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    })

    if (existingTenant) {
      return NextResponse.json(
        { error: 'El slug ya está en uso' },
        { status: 400 }
      )
    }

    // Crear o encontrar usuario owner
    let user = await prisma.user.findUnique({
      where: { email: ownerEmail },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: ownerEmail,
          name: ownerName || ownerEmail,
        },
      })
    }

    // Crear tenant
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        subdomain: subdomain || null,
        customDomain: customDomain || null,
        plan: plan || 'FREE',
        isActive: true,
        settings: {},
      },
    })

    // Asignar usuario como OWNER del tenant
    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'OWNER',
      },
    })

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
      },
      owner: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error) {
    console.error('Error creando tenant:', error)
    return NextResponse.json(
      { error: 'Error al crear tenant', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tenants
 * Obtiene información del tenant actual (para el usuario autenticado)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || request.cookies.get('user_id')?.value
    const tenantSlug = request.headers.get('X-Tenant-Id') || 
                       request.nextUrl.searchParams.get('tenant') ||
                       request.cookies.get('tenant_id')?.value

    if (!userId || !tenantSlug) {
      return NextResponse.json(
        { error: 'userId y tenant son requeridos' },
        { status: 400 }
      )
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: tenantSlug },
          { slug: tenantSlug },
          { subdomain: tenantSlug },
        ],
        isActive: true,
      },
      include: {
        users: {
          where: { userId },
          select: {
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            documents: true,
            users: true,
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el usuario pertenece al tenant
    if (tenant.users.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no autorizado para este tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
      plan: tenant.plan,
      isActive: tenant.isActive,
      settings: tenant.settings,
      maxUsers: tenant.maxUsers,
      maxDocuments: tenant.maxDocuments,
      maxStorageGB: tenant.maxStorageGB,
      userRole: tenant.users[0].role,
      stats: {
        documents: tenant._count.documents,
        users: tenant._count.users,
      },
    })
  } catch (error) {
    console.error('Error obteniendo tenant:', error)
    return NextResponse.json(
      { error: 'Error al obtener tenant', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

