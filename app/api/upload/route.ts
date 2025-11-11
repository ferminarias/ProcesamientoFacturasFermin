import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db/prisma'
import { documentQueue } from '@/lib/queue/queue.config'
import { env } from '@/lib/config/env'
import { validateTenant } from '@/lib/middleware/tenant.middleware'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * POST /api/upload
 * Sube uno o múltiples archivos y los agrega a la cola de procesamiento
 * MULTI-TENANT: Requiere tenantId válido
 */
export async function POST(request: NextRequest) {
  try {
    // Validar tenant
    const tenantValidation = await validateTenant(request)
    if ('error' in tenantValidation) {
      return tenantValidation.error
    }
    const { context } = tenantValidation
    const { tenantId, userId } = context

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron archivos' },
        { status: 400 }
      )
    }

    // Límite de 50 archivos por batch
    if (files.length > 50) {
      return NextResponse.json(
        { error: 'Máximo 50 archivos por batch' },
        { status: 400 }
      )
    }

    const uploadedDocuments = []

    for (const file of files) {
      try {
        // Validar tipo de archivo
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        if (!allowedTypes.includes(file.type)) {
          console.warn(`Tipo de archivo no permitido: ${file.type}`)
          continue
        }

        // Validar tamaño (máximo 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
          console.warn(`Archivo demasiado grande: ${file.name}`)
          continue
        }

        // Subir a Vercel Blob (o S3 en producción)
        const blob = await put(file.name, file, {
          access: 'public',
          contentType: file.type,
        })

        // Verificar límites del tenant
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { maxDocuments: true, _count: { select: { documents: true } } },
        })

        if (tenant && tenant._count.documents >= tenant.maxDocuments) {
          return NextResponse.json(
            { error: 'Límite de documentos alcanzado para este plan' },
            { status: 403 }
          )
        }

        // Crear documento en la base de datos (MULTI-TENANT: incluir tenantId)
        const document = await prisma.document.create({
          data: {
            tenantId, // MULTI-TENANT: Aislado por tenant
            userId,
            fileName: file.name,
            fileUrl: blob.url,
            fileSize: file.size,
            mimeType: file.type,
            status: 'QUEUED',
          },
        })

        // Agregar a la cola de procesamiento (MULTI-TENANT: incluir tenantId)
        await documentQueue.add({
          documentId: document.id,
          tenantId, // MULTI-TENANT: Requerido en job
          userId,
          fileName: file.name,
          fileUrl: blob.url,
        }, {
          jobId: `${tenantId}:${document.id}`, // MULTI-TENANT: Prefijo con tenantId
        })

        uploadedDocuments.push({
          id: document.id,
          fileName: document.fileName,
          status: document.status,
          fileUrl: document.fileUrl,
        })
      } catch (error) {
        console.error(`Error procesando archivo ${file.name}:`, error)
        // Continuar con el siguiente archivo
      }
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
      message: `${uploadedDocuments.length} archivo(s) subido(s) exitosamente`,
    })
  } catch (error) {
    console.error('Error en upload:', error)
    return NextResponse.json(
      { error: 'Error al subir archivos', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

