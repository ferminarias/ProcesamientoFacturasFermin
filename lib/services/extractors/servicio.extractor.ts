import OpenAI from 'openai'
import { env } from '@/lib/config/env'
import { ServicioData } from '@/shared/types/document.types'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * Extrae información de un comprobante de servicio
 */
export async function extractServicioData(imageUrl: string): Promise<ServicioData> {
  const extractionPrompt = `
Extrae información de este comprobante de servicio.

JSON esperado:
{
  "tipo_servicio": "luz/gas/agua/internet/telefonia/cable",
  "empresa_proveedora": "",
  "numero_cuenta": "",
  "numero_medidor": "",
  "titular": "",
  "domicilio_suministro": "",
  
  "periodo_facturado": {
    "fecha_desde": "YYYY-MM-DD",
    "fecha_hasta": "YYYY-MM-DD",
    "dias_facturados": 0
  },
  
  "consumo": {
    "lectura_anterior": 0,
    "lectura_actual": 0,
    "consumo_unidades": 0,
    "unidad_medida": "kWh/m3/MB",
    "precio_unitario": 0
  },
  
  "cargos": [
    {
      "concepto": "",
      "descripcion": "",
      "importe": 0
    }
  ],
  
  "totales": {
    "subtotal": 0,
    "iva": 0,
    "impuestos_municipales": 0,
    "otros_cargos": 0,
    "total_a_pagar": 0
  },
  
  "vencimientos": {
    "primer_vencimiento": "YYYY-MM-DD",
    "segundo_vencimiento": "YYYY-MM-DD",
    "recargo_segundo_venc": 0
  },
  
  "datos_pago": {
    "codigo_pago_electronico": "",
    "codigo_barras": ""
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
    return validateAndNormalizeServicioData(extractedData)
  } catch (error) {
    console.error('Error en extracción de servicio:', error)
    throw new Error(`Error al extraer datos de servicio: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Valida y normaliza los datos extraídos
 */
function validateAndNormalizeServicioData(data: any): ServicioData {
  const cargos = Array.isArray(data.cargos) ? data.cargos.map((cargo: any) => ({
    concepto: cargo.concepto || '',
    descripcion: cargo.descripcion || '',
    importe: parseFloat(cargo.importe) || 0,
  })) : []

  return {
    tipo_servicio: data.tipo_servicio || 'luz',
    empresa_proveedora: data.empresa_proveedora || '',
    numero_cuenta: data.numero_cuenta || '',
    numero_medidor: data.numero_medidor,
    titular: data.titular || '',
    domicilio_suministro: data.domicilio_suministro || '',
    periodo_facturado: {
      fecha_desde: data.periodo_facturado?.fecha_desde || '',
      fecha_hasta: data.periodo_facturado?.fecha_hasta || '',
      dias_facturados: parseFloat(data.periodo_facturado?.dias_facturados) || 0,
    },
    consumo: data.consumo ? {
      lectura_anterior: parseFloat(data.consumo.lectura_anterior) || 0,
      lectura_actual: parseFloat(data.consumo.lectura_actual) || 0,
      consumo_unidades: parseFloat(data.consumo.consumo_unidades) || 0,
      unidad_medida: data.consumo.unidad_medida || '',
      precio_unitario: parseFloat(data.consumo.precio_unitario) || 0,
    } : undefined,
    cargos,
    totales: {
      subtotal: parseFloat(data.totales?.subtotal) || 0,
      iva: parseFloat(data.totales?.iva) || 0,
      impuestos_municipales: parseFloat(data.totales?.impuestos_municipales) || 0,
      otros_cargos: parseFloat(data.totales?.otros_cargos) || 0,
      total_a_pagar: parseFloat(data.totales?.total_a_pagar) || 0,
    },
    vencimientos: {
      primer_vencimiento: data.vencimientos?.primer_vencimiento || '',
      segundo_vencimiento: data.vencimientos?.segundo_vencimiento,
      recargo_segundo_venc: parseFloat(data.vencimientos?.recargo_segundo_venc) || 0,
    },
    datos_pago: data.datos_pago ? {
      codigo_pago_electronico: data.datos_pago.codigo_pago_electronico,
      codigo_barras: data.datos_pago.codigo_barras,
    } : undefined,
  }
}

