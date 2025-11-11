import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { validateTenant } from '@/lib/middleware/tenant.middleware'
import { DocumentCache } from '@/lib/cache/redis.cache'

/**
 * GET /api/documents/[id]
 * Obtiene un documento específico
 * MULTI-TENANT: Verifica que el documento pertenece al tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validar tenant
    const tenantValidation = await validateTenant(request)
    if ('error' in tenantValidation) {
      return tenantValidation.error
    }
    const { context } = tenantValidation
    const { tenantId } = context

    // Intentar obtener del cache
    const cached = await DocumentCache.getDocument(tenantId, params.id)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Buscar documento (MULTI-TENANT: filtrar por tenantId)
    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        tenantId, // MULTI-TENANT: Asegurar aislamiento
      },
      include: {
        feedbacks: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    // Guardar en cache
    await DocumentCache.setDocument(tenantId, params.id, document)

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error obteniendo documento:', error)
    return NextResponse.json(
      { error: 'Error al obtener documento', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/documents/[id]
 * Actualiza un documento (usado para validación)
 * MULTI-TENANT: Verifica que el documento pertenece al tenant
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validar tenant
    const tenantValidation = await validateTenant(request)
    if ('error' in tenantValidation) {
      return tenantValidation.error
    }
    const { context } = tenantValidation
    const { tenantId, userId } = context

    const body = await request.json()
    const { validationStatus, extractedData } = body

    // Verificar que el documento pertenece al tenant y usuario
    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        tenantId, // MULTI-TENANT: Verificar tenantId
        userId,
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    // Actualizar documento
    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        validationStatus: validationStatus || document.validationStatus,
        extractedData: extractedData || document.extractedData,
        validatedAt: validationStatus === 'APPROVED' || validationStatus === 'REJECTED' ? new Date() : document.validatedAt,
        validatedBy: validationStatus ? userId : document.validatedBy,
        status: validationStatus === 'APPROVED' ? 'COMPLETED' : document.status,
      },
    })

    // Si hay correcciones, guardar feedback
    if (body.corrections && body.corrections.length > 0) {
      await prisma.documentFeedback.create({
        data: {
          documentId: params.id,
          userId,
          corrections: body.corrections,
        },
      })
    }

    // Invalidar cache
    await DocumentCache.deleteDocument(tenantId, params.id)
    await DocumentCache.invalidateDocumentList(tenantId, userId)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error actualizando documento:', error)
    return NextResponse.json(
      { error: 'Error al actualizar documento', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/documents/[id]
 * Elimina un documento
 * MULTI-TENANT: Verifica que el documento pertenece al tenant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validar tenant
    const tenantValidation = await validateTenant(request)
    if ('error' in tenantValidation) {
      return tenantValidation.error
    }
    const { context } = tenantValidation
    const { tenantId, userId } = context

    // Verificar que el documento pertenece al tenant y usuario
    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        tenantId, // MULTI-TENANT: Verificar tenantId
        userId,
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    // Eliminar documento (cascade eliminará feedbacks y export logs)
    await prisma.document.delete({
      where: { id: params.id },
    })

    // Invalidar cache
    await DocumentCache.deleteDocument(tenantId, params.id)
    await DocumentCache.invalidateDocumentList(tenantId, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando documento:', error)
    return NextResponse.json(
      { error: 'Error al eliminar documento', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

