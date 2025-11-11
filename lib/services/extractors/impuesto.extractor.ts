import OpenAI from 'openai'
import { env } from '@/lib/config/env'
import { ImpuestoData } from '@/shared/types/document.types'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * Extrae información de un comprobante de impuesto
 */
export async function extractImpuestoData(imageUrl: string): Promise<ImpuestoData> {
  const extractionPrompt = `
Extrae información de este comprobante de impuesto.

JSON esperado:
{
  "tipo_impuesto": "arba/abl/patente/iibb/monotributo/ganancias",
  "organismo_recaudador": "",
  "jurisdiccion": "",
  "contribuyente": "",
  "cuit_cuil": "",
  "domicilio": "",
  
  "liquidacion": {
    "numero_partida": "",
    "numero_liquidacion": "",
    "periodo_fiscal": "YYYY-MM",
    "año_fiscal": 2025,
    "anticipo_cuota": ""
  },
  
  "deuda": {
    "capital": 0,
    "intereses": 0,
    "recargos": 0,
    "total_deuda": 0
  },
  
  "vencimientos": [
    {
      "cuota": "",
      "fecha_vencimiento": "YYYY-MM-DD",
      "importe": 0,
      "descuento_pago_adelantado": 0
    }
  ],
  
  "datos_pago": {
    "codigo_pago_electronico": "",
    "cbu_debito_automatico": ""
  }
}

IMPORTANTE: 
- Todos los números deben ser números, no strings
- Fechas en formato YYYY-MM-DD
- Responde SOLO con el JSON, sin texto adicional.
`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: extractionPrompt },
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
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const extractedData = JSON.parse(response.choices[0].message.content || '{}')
    
    // Validar y normalizar datos
    return validateAndNormalizeImpuestoData(extractedData)
  } catch (error) {
    console.error('Error en extracción de impuesto:', error)
    throw new Error(`Error al extraer datos de impuesto: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Valida y normaliza los datos extraídos
 */
function validateAndNormalizeImpuestoData(data: any): ImpuestoData {
  const vencimientos = Array.isArray(data.vencimientos) ? data.vencimientos.map((venc: any) => ({
    cuota: venc.cuota || '',
    fecha_vencimiento: venc.fecha_vencimiento || '',
    importe: parseFloat(venc.importe) || 0,
    descuento_pago_adelantado: parseFloat(venc.descuento_pago_adelantado) || 0,
  })) : []

  return {
    tipo_impuesto: data.tipo_impuesto || 'arba',
    organismo_recaudador: data.organismo_recaudador || '',
    jurisdiccion: data.jurisdiccion || '',
    contribuyente: data.contribuyente || '',
    cuit_cuil: data.cuit_cuil || '',
    domicilio: data.domicilio || '',
    liquidacion: {
      numero_partida: data.liquidacion?.numero_partida,
      numero_liquidacion: data.liquidacion?.numero_liquidacion || '',
      periodo_fiscal: data.liquidacion?.periodo_fiscal || '',
      año_fiscal: parseFloat(data.liquidacion?.año_fiscal) || new Date().getFullYear(),
      anticipo_cuota: data.liquidacion?.anticipo_cuota,
    },
    deuda: {
      capital: parseFloat(data.deuda?.capital) || 0,
      intereses: parseFloat(data.deuda?.intereses) || 0,
      recargos: parseFloat(data.deuda?.recargos) || 0,
      total_deuda: parseFloat(data.deuda?.total_deuda) || 0,
    },
    vencimientos,
    datos_pago: data.datos_pago ? {
      codigo_pago_electronico: data.datos_pago.codigo_pago_electronico,
      cbu_debito_automatico: data.datos_pago.cbu_debito_automatico,
    } : undefined,
  }
}

