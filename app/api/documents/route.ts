import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { validateTenant } from '@/lib/middleware/tenant.middleware'
import { DocumentCache } from '@/lib/cache/redis.cache'

/**
 * GET /api/documents
 * Obtiene la lista de documentos del usuario
 * MULTI-TENANT: Filtra automáticamente por tenantId
 */
export async function GET(request: NextRequest) {
  try {
    // Validar tenant
    const tenantValidation = await validateTenant(request)
    if ('error' in tenantValidation) {
      return tenantValidation.error
    }
    const { context } = tenantValidation
    const { tenantId, userId } = context

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const documentType = searchParams.get('documentType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Crear clave de cache
    const cacheKey = `${status || 'all'}:${documentType || 'all'}:${page}:${limit}`
    
    // Intentar obtener del cache
    const cached = await DocumentCache.getDocumentList(tenantId, userId, cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const where: any = {
      tenantId, // MULTI-TENANT: Filtrar por tenantId
      userId,
    }

    if (status) {
      where.status = status
    }

    if (documentType) {
      where.documentType = documentType
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          status: true,
          documentType: true,
          subtype: true,
          confidence: true,
          validationStatus: true,
          extractedData: true,
          createdAt: true,
          processedAt: true,
          errorMessage: true,
        },
      }),
      prisma.document.count({ where }),
    ])

    const result = {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }

    // Guardar en cache
    await DocumentCache.setDocumentList(tenantId, userId, cacheKey, result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error obteniendo documentos:', error)
    return NextResponse.json(
      { error: 'Error al obtener documentos', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

