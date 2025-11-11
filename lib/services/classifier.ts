import OpenAI from 'openai'
import { env } from '@/lib/config/env'
import { ClassificationResult, DocumentType } from '@/shared/types/document.types'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * Clasifica un documento financiero argentino usando GPT-4o Vision
 */
export async function classifyDocument(imageUrl: string): Promise<ClassificationResult> {
  const classificationPrompt = `
Analiza esta imagen de documento financiero argentino y clasifícalo.

Devuelve JSON con esta estructura:
{
  "tipo_documento": "factura_a" | "factura_b" | "factura_c" | "servicio_luz" | "servicio_gas" | "servicio_agua" | "servicio_internet" | "servicio_telefonia" | "impuesto_arba" | "impuesto_abl" | "impuesto_patente" | "impuesto_iibb" | "resumen_tarjeta" | "otro",
  "subtipo": "string", // ej: "EDESUR", "Banco Galicia", etc
  "confianza": 0-100,
  "razon_clasificacion": "string explicando por qué"
}

Pistas de clasificación:
- Facturas: tienen CUIT, CAE, tipo A/B/C, "AFIP"
- Servicios: logos de empresas (Edenor, Edesur, Metrogas, etc), "kWh", "m3"
- Impuestos: logos gubernamentales, "ARBA", "GCBA", "Partida"
- Tarjetas: logos bancarios, "Resumen", "Visa/Mastercard", tabla de consumos

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.
`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: classificationPrompt },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    // Mapear tipos de documento al enum
    const tipoDocumento = mapDocumentType(result.tipo_documento)
    
    return {
      tipo_documento: tipoDocumento,
      subtipo: result.subtipo || '',
      confianza: result.confianza || 0,
      razon_clasificacion: result.razon_clasificacion || '',
    }
  } catch (error) {
    console.error('Error en clasificación:', error)
    throw new Error(`Error al clasificar documento: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Mapea el tipo de documento del string al enum
 */
function mapDocumentType(tipo: string): DocumentType {
  const tipoLower = tipo.toLowerCase()
  
  const mapping: Record<string, DocumentType> = {
    'factura_a': DocumentType.FACTURA_A,
    'factura_b': DocumentType.FACTURA_B,
    'factura_c': DocumentType.FACTURA_C,
    'factura_e': DocumentType.FACTURA_E,
    'factura_m': DocumentType.FACTURA_M,
    'servicio_luz': DocumentType.SERVICIO_LUZ,
    'servicio_gas': DocumentType.SERVICIO_GAS,
    'servicio_agua': DocumentType.SERVICIO_AGUA,
    'servicio_internet': DocumentType.SERVICIO_INTERNET,
    'servicio_telefonia': DocumentType.SERVICIO_TELEFONIA,
    'servicio_cable': DocumentType.SERVICIO_CABLE,
    'impuesto_arba': DocumentType.IMPUESTO_ARBA,
    'impuesto_abl': DocumentType.IMPUESTO_ABL,
    'impuesto_patente': DocumentType.IMPUESTO_PATENTE,
    'impuesto_iibb': DocumentType.IMPUESTO_IIBB,
    'impuesto_monotributo': DocumentType.IMPUESTO_MONOTRIBUTO,
    'impuesto_ganancias': DocumentType.IMPUESTO_GANANCIAS,
    'resumen_tarjeta': DocumentType.RESUMEN_TARJETA,
  }
  
  return mapping[tipoLower] || DocumentType.OTRO
}

