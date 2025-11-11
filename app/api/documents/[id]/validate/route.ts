import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { validateTenant } from '@/lib/middleware/tenant.middleware'
import { DocumentCache } from '@/lib/cache/redis.cache'

/**
 * POST /api/documents/[id]/validate
 * Valida un documento con las correcciones del usuario
 * MULTI-TENANT: Verifica que el documento pertenece al tenant
 */
export async function POST(
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
    const { validationStatus, extractedData, corrections } = body

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
        validationStatus: validationStatus || 'APPROVED',
        extractedData: extractedData || document.extractedData,
        validatedAt: new Date(),
        validatedBy: userId,
        status: validationStatus === 'APPROVED' ? 'COMPLETED' : 'VALIDATING',
      },
    })

    // Guardar feedback si hay correcciones
    if (corrections && corrections.length > 0) {
      await prisma.documentFeedback.create({
        data: {
          documentId: params.id,
          userId,
          corrections: corrections,
        },
      })
    }

    // Invalidar cache
    await DocumentCache.deleteDocument(tenantId, params.id)
    await DocumentCache.invalidateDocumentList(tenantId, userId)

    return NextResponse.json({
      success: true,
      document: updated,
    })
  } catch (error) {
    console.error('Error validando documento:', error)
    return NextResponse.json(
      { error: 'Error al validar documento', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

