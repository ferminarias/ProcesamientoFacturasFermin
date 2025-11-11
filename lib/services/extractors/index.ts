// Exportar todos los extractores
import { extractFacturaData } from './factura.extractor'
import { extractServicioData } from './servicio.extractor'
import { extractImpuestoData } from './impuesto.extractor'
import { extractTarjetaData } from './tarjeta.extractor'
import { DocumentType, ExtractedData } from '@/shared/types/document.types'

/**
 * Extrae datos según el tipo de documento
 */
export async function extractData(
  imageUrl: string,
  documentType: DocumentType
): Promise<ExtractedData> {
  switch (documentType) {
    case DocumentType.FACTURA_A:
    case DocumentType.FACTURA_B:
    case DocumentType.FACTURA_C:
    case DocumentType.FACTURA_E:
    case DocumentType.FACTURA_M:
      return await extractFacturaData(imageUrl)
    
    case DocumentType.SERVICIO_LUZ:
    case DocumentType.SERVICIO_GAS:
    case DocumentType.SERVICIO_AGUA:
    case DocumentType.SERVICIO_INTERNET:
    case DocumentType.SERVICIO_TELEFONIA:
    case DocumentType.SERVICIO_CABLE:
      return await extractServicioData(imageUrl)
    
    case DocumentType.IMPUESTO_ARBA:
    case DocumentType.IMPUESTO_ABL:
    case DocumentType.IMPUESTO_PATENTE:
    case DocumentType.IMPUESTO_IIBB:
    case DocumentType.IMPUESTO_MONOTRIBUTO:
    case DocumentType.IMPUESTO_GANANCIAS:
      return await extractImpuestoData(imageUrl)
    
    case DocumentType.RESUMEN_TARJETA:
      return await extractTarjetaData(imageUrl)
    
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

