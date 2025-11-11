import OpenAI from 'openai'
import { env } from '@/lib/config/env'
import { TarjetaData } from '@/shared/types/document.types'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * Extrae información de un resumen de tarjeta de crédito
 */
export async function extractTarjetaData(imageUrl: string): Promise<TarjetaData> {
  const extractionPrompt = `
Extrae información de este resumen de tarjeta de crédito.

JSON esperado:
{
  "banco_emisor": "",
  "tipo_tarjeta": "visa/mastercard/amex/cabal/naranja",
  "numero_tarjeta_enmascarado": "XXXX-XXXX-XXXX-1234",
  "titular": "",
  "fecha_cierre": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD",
  
  "resumen_anterior": {
    "saldo_anterior": 0,
    "pago_anterior": 0,
    "ajustes": 0
  },
  
  "consumos": [
    {
      "fecha": "YYYY-MM-DD",
      "comercio": "",
      "descripcion": "",
      "cuota": "1/1" o "3/6",
      "importe_pesos": 0,
      "importe_dolares": 0
    }
  ],
  
  "totales": {
    "total_consumos": 0,
    "intereses": 0,
    "cargos_servicios": 0,
    "impuestos": 0,
    "total_resumen": 0,
    "pago_minimo": 0,
    "pago_total_sin_interes": 0
  },
  
  "cuotas_vigentes": [
    {
      "descripcion": "",
      "cuota_actual": "3/6",
      "importe_cuota": 0
    }
  ]
}

IMPORTANTE: 
- Todos los números deben ser números, no strings
- Fechas en formato YYYY-MM-DD
- NUNCA extraigas números completos de tarjeta, solo los últimos 4 dígitos
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
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    const extractedData = JSON.parse(response.choices[0].message.content || '{}')
    
    // Validar y normalizar datos
    return validateAndNormalizeTarjetaData(extractedData)
  } catch (error) {
    console.error('Error en extracción de tarjeta:', error)
    throw new Error(`Error al extraer datos de tarjeta: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Valida y normaliza los datos extraídos
 */
function validateAndNormalizeTarjetaData(data: any): TarjetaData {
  const consumos = Array.isArray(data.consumos) ? data.consumos.map((consumo: any) => ({
    fecha: consumo.fecha || '',
    comercio: consumo.comercio || '',
    descripcion: consumo.descripcion || '',
    cuota: consumo.cuota,
    importe_pesos: parseFloat(consumo.importe_pesos) || 0,
    importe_dolares: parseFloat(consumo.importe_dolares) || 0,
  })) : []

  const cuotasVigentes = Array.isArray(data.cuotas_vigentes) ? data.cuotas_vigentes.map((cuota: any) => ({
    descripcion: cuota.descripcion || '',
    cuota_actual: cuota.cuota_actual || '',
    importe_cuota: parseFloat(cuota.importe_cuota) || 0,
  })) : []

  return {
    banco_emisor: data.banco_emisor || '',
    tipo_tarjeta: data.tipo_tarjeta || 'visa',
    numero_tarjeta_enmascarado: data.numero_tarjeta_enmascarado || '',
    titular: data.titular || '',
    fecha_cierre: data.fecha_cierre || '',
    fecha_vencimiento: data.fecha_vencimiento || '',
    resumen_anterior: data.resumen_anterior ? {
      saldo_anterior: parseFloat(data.resumen_anterior.saldo_anterior) || 0,
      pago_anterior: parseFloat(data.resumen_anterior.pago_anterior) || 0,
      ajustes: parseFloat(data.resumen_anterior.ajustes) || 0,
    } : undefined,
    consumos,
    totales: {
      total_consumos: parseFloat(data.totales?.total_consumos) || 0,
      intereses: parseFloat(data.totales?.intereses) || 0,
      cargos_servicios: parseFloat(data.totales?.cargos_servicios) || 0,
      impuestos: parseFloat(data.totales?.impuestos) || 0,
      total_resumen: parseFloat(data.totales?.total_resumen) || 0,
      pago_minimo: parseFloat(data.totales?.pago_minimo) || 0,
      pago_total_sin_interes: parseFloat(data.totales?.pago_total_sin_interes) || 0,
    },
    cuotas_vigentes: cuotasVigentes.length > 0 ? cuotasVigentes : undefined,
  }
}

