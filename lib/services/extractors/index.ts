// Exportar todos los extractores
import { extractFacturaData } from './factura.extractor'
import { extractServicioData } from './servicio.extractor'
import { extractImpuestoData } from './impuesto.extractor'
import { extractTarjetaData } from './tarjeta.extractor'
import { DocumentType, ExtractedData } from '@/shared/types/document.types'
import { DocumentType as PrismaDocumentType } from '@prisma/client'
import type { ExtractionContext } from '../learning.service'

/**
 * Extrae datos según el tipo de documento con aprendizaje adaptativo
 */
export async function extractData(
  imageUrl: string,
  documentType: DocumentType,
  context?: ExtractionContext
): Promise<{ data: ExtractedData; configId?: string }> {
  // Convertir DocumentType de shared a Prisma DocumentType
  const prismaDocType = documentType as unknown as PrismaDocumentType

  // Crear contexto si se proporciona tenantId
  const extractionContext = context
    ? {
        ...context,
        documentType: prismaDocType,
      }
    : undefined

  switch (documentType) {
    case DocumentType.FACTURA_A:
    case DocumentType.FACTURA_B:
    case DocumentType.FACTURA_C:
    case DocumentType.FACTURA_E:
    case DocumentType.FACTURA_M:
      return await extractFacturaData(imageUrl, extractionContext)

    case DocumentType.SERVICIO_LUZ:
    case DocumentType.SERVICIO_GAS:
    case DocumentType.SERVICIO_AGUA:
    case DocumentType.SERVICIO_INTERNET:
    case DocumentType.SERVICIO_TELEFONIA:
    case DocumentType.SERVICIO_CABLE:
      // Por ahora, extractores de servicio no tienen aprendizaje
      const servicioData = await extractServicioData(imageUrl)
      return { data: servicioData }

    case DocumentType.IMPUESTO_ARBA:
    case DocumentType.IMPUESTO_ABL:
    case DocumentType.IMPUESTO_PATENTE:
    case DocumentType.IMPUESTO_IIBB:
    case DocumentType.IMPUESTO_MONOTRIBUTO:
    case DocumentType.IMPUESTO_GANANCIAS:
      const impuestoData = await extractImpuestoData(imageUrl)
      return { data: impuestoData }

    case DocumentType.RESUMEN_TARJETA:
      const tarjetaData = await extractTarjetaData(imageUrl)
      return { data: tarjetaData }

    default:
      throw new Error(`Tipo de documento no soportado: ${documentType}`)
  }
}

export {
  extractFacturaData,
  extractServicioData,
  extractImpuestoData,
  extractTarjetaData,
}

