import { Job } from 'bull'
import { DocumentJobData, DocumentJobResult } from '../queue.config'
import { classifyDocument } from '@/lib/services/classifier'
import { extractData } from '@/lib/services/extractors'
import { prisma } from '@/lib/db/prisma'
import { DocumentStatus, DocumentType } from '@/shared/types/document.types'

/**
 * Procesa un documento: clasifica y extrae datos
 * MULTI-TENANT: Incluye tenantId para aislamiento
 */
export async function processDocument(job: Job<DocumentJobData>): Promise<DocumentJobResult> {
  const { documentId, tenantId, userId, fileName, fileUrl } = job.data
  
  try {
    // Verificar que el documento pertenece al tenant (seguridad multi-tenant)
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenantId, // MULTI-TENANT: Verificar tenantId
      },
    })

    if (!document) {
      throw new Error(`Documento ${documentId} no encontrado para tenant ${tenantId}`)
    }

    // Actualizar estado a PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PROCESSING',
        jobId: job.id.toString(),
      },
    })

    // Paso 1: Clasificar documento
    job.progress(10)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'CLASSIFYING' },
    })

    const classification = await classifyDocument(fileUrl)
    
    await prisma.document.update({
      where: { id: documentId },
      data: {
        documentType: classification.tipo_documento as DocumentType,
        subtype: classification.subtipo,
        confidence: classification.confianza,
        classificationReason: classification.razon_clasificacion,
        status: 'EXTRACTING',
      },
    })

    job.progress(50)

    // Paso 2: Extraer datos según el tipo
    const extractedData = await extractData(fileUrl, classification.tipo_documento)
    
    job.progress(90)

    // Actualizar documento con datos extraídos
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedData: extractedData as any,
        status: 'VALIDATING',
        processedAt: new Date(),
      },
    })

    job.progress(100)

    return {
      documentId,
      tenantId, // MULTI-TENANT: Incluir en resultado
      classification,
      extractedData,
      success: true,
    }
  } catch (error) {
    console.error(`Error procesando documento ${documentId}:`, error)
    
    // Actualizar documento con error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
        retryCount: {
          increment: 1,
        },
      },
    })

    throw error
  }
}

