import { Job } from 'bull'
import { DocumentJobData, DocumentJobResult } from '../queue.config'
import { classifyDocument } from '@/lib/services/classifier'
import { extractData } from '@/lib/services/extractors'
import { saveToSpecializedTable, detectSupplierInfo } from '@/lib/services/extractors/adaptive-extractor'
import { prisma } from '@/lib/db/prisma'
import { DocumentStatus, DocumentType } from '@/shared/types/document.types'
import { DocumentType as PrismaDocumentType } from '@prisma/client'

/**
 * Procesa un documento: clasifica, extrae datos y guarda en tablas especializadas
 * MULTI-TENANT: Incluye tenantId para aislamiento
 * LEARNING: Usa aprendizaje adaptativo basado en feedback
 */
export async function processDocument(job: Job<DocumentJobData>): Promise<DocumentJobResult> {
  const { documentId, tenantId, userId, fileName, fileUrl } = job.data
  const startTime = Date.now()

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

    // Paso 2: Extraer datos según el tipo con aprendizaje adaptativo
    const prismaDocType = classification.tipo_documento as unknown as PrismaDocumentType

    // Crear contexto de extracción con tenantId para usar aprendizaje
    const extractionContext = {
      tenantId,
      documentType: prismaDocType,
    }

    const extractionResult = await extractData(
      fileUrl,
      classification.tipo_documento,
      extractionContext
    )

    const extractedData = extractionResult.data
    const configId = extractionResult.configId

    // Detectar información del proveedor desde los datos extraídos
    const supplierInfo = detectSupplierInfo(extractedData)

    job.progress(75)

    // Actualizar documento con datos extraídos y clasificación completa
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedData: extractedData as any,
        status: 'VALIDATING',
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        classification: {
          tipo_documento: classification.tipo_documento,
          subtipo: classification.subtipo,
          confianza: classification.confianza,
          razon_clasificacion: classification.razon_clasificacion,
          supplierCuit: supplierInfo.cuit,
          supplierName: supplierInfo.name,
          configId, // Almacenar qué configuración se usó
        } as any,
      },
    })

    job.progress(85)

    // Paso 3: Guardar en tabla especializada
    try {
      await saveToSpecializedTable(
        documentId,
        tenantId,
        prismaDocType,
        extractedData,
        prisma
      )
      console.log(`[Processor] Datos guardados en tabla especializada para ${classification.tipo_documento}`)
    } catch (error) {
      console.error('[Processor] Error guardando en tabla especializada:', error)
      // No fallar el procesamiento completo si falla el guardado en tabla especializada
    }

    job.progress(95)

    // Marcar como completado
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
      },
    })

    job.progress(100)

    return {
      documentId,
      tenantId, // MULTI-TENANT: Incluir en resultado
      classification,
      extractedData,
      success: true,
      configId, // Incluir ID de configuración usada
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

