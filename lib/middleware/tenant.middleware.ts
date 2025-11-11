import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * Contexto del tenant para el request actual
 */
export interface TenantContext {
  tenantId: string
  tenantSlug: string
  userId: string
  userRole: string
}

/**
 * Extrae el tenant del request desde:
 * 1. Header X-Tenant-Id
 * 2. Subdomain (cliente1.sistema.com)
 * 3. Query parameter ?tenant=slug
 * 4. Cookie tenant_id
 */
export async function getTenantFromRequest(
  request: NextRequest
): Promise<{ tenantId: string; tenantSlug: string } | null> {
  // 1. Intentar desde header
  const tenantId = request.headers.get('X-Tenant-Id')
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, isActive: true },
    })
    if (tenant && tenant.isActive) {
      return { tenantId: tenant.id, tenantSlug: tenant.slug }
    }
  }

  // 2. Intentar desde subdomain
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]
  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: subdomain },
          { slug: subdomain },
        ],
        isActive: true,
      },
      select: { id: true, slug: true },
    })
    if (tenant) {
      return { tenantId: tenant.id, tenantSlug: tenant.slug }
    }
  }

  // 3. Intentar desde query parameter
  const tenantSlug = request.nextUrl.searchParams.get('tenant')
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, isActive: true },
    })
    if (tenant && tenant.isActive) {
      return { tenantId: tenant.id, tenantSlug: tenant.slug }
    }
  }

  // 4. Intentar desde cookie
  const cookieTenantId = request.cookies.get('tenant_id')?.value
  if (cookieTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: cookieTenantId },
      select: { id: true, slug: true, isActive: true },
    })
    if (tenant && tenant.isActive) {
      return { tenantId: tenant.id, tenantSlug: tenant.slug }
    }
  }

  return null
}

/**
 * Obtiene el contexto completo del tenant (tenant + user)
 */
export async function getTenantContext(
  request: NextRequest
): Promise<TenantContext | null> {
  const tenantInfo = await getTenantFromRequest(request)
  if (!tenantInfo) {
    return null
  }

  // Obtener userId del request (desde auth token, session, etc.)
  const userId = request.headers.get('X-User-Id') || request.cookies.get('user_id')?.value
  if (!userId) {
    return null
  }

  // Verificar que el usuario pertenece al tenant
  const tenantUser = await prisma.tenantUser.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenantInfo.tenantId,
        userId: userId,
      },
    },
    select: {
      role: true,
    },
  })

  if (!tenantUser) {
    return null
  }

  return {
    tenantId: tenantInfo.tenantId,
    tenantSlug: tenantInfo.tenantSlug,
    userId,
    userRole: tenantUser.role,
  }
}

/**
 * Middleware para validar tenant en rutas API
 */
export async function validateTenant(
  request: NextRequest
): Promise<{ context: TenantContext } | { error: NextResponse }> {
  const context = await getTenantContext(request)

  if (!context) {
    return {
      error: NextResponse.json(
        { error: 'Tenant no válido o usuario no autorizado' },
        { status: 401 }
      ),
    }
  }

  return { context }
}

/**
 * Verifica si un usuario tiene permiso en el tenant
 */
export async function hasTenantPermission(
  tenantId: string,
  userId: string,
  requiredRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
): Promise<boolean> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
    select: {
      role: true,
    },
  })

  if (!tenantUser) {
    return false
  }

  if (!requiredRole) {
    return true
  }

  const roleHierarchy = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    VIEWER: 1,
  }

  return roleHierarchy[tenantUser.role as keyof typeof roleHierarchy] >=
    roleHierarchy[requiredRole]
}

