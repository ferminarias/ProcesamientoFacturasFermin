import OpenAI from 'openai'
import { env } from '@/lib/config/env'
import { FacturaData } from '@/shared/types/document.types'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * Extrae información de una factura argentina
 */
export async function extractFacturaData(imageUrl: string): Promise<FacturaData> {
  const extractionPrompt = `
Extrae TODA la información de esta factura argentina.

JSON esperado:
{
  "tipo_comprobante": "Factura A/B/C/E/M",
  "numero_completo": "0001-00001234",
  "punto_venta": "0001",
  "numero": "00001234",
  "fecha_emision": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD",
  
  "emisor": {
    "razon_social": "",
    "nombre_fantasia": "",
    "cuit": "XX-XXXXXXXX-X",
    "domicilio_completo": "",
    "localidad": "",
    "provincia": "",
    "condicion_iva": "Responsable Inscripto/Monotributista/Exento",
    "inicio_actividades": "YYYY-MM-DD"
  },
  
  "receptor": {
    "razon_social": "",
    "cuit": "",
    "domicilio": "",
    "condicion_iva": ""
  },
  
  "items": [
    {
      "codigo_producto": "",
      "descripcion": "",
      "cantidad": 0,
      "unidad_medida": "",
      "precio_unitario": 0,
      "bonificacion_porcentaje": 0,
      "subtotal_sin_iva": 0,
      "alicuota_iva": 21,
      "total_item": 0
    }
  ],
  
  "totales": {
    "subtotal": 0,
    "iva_21": 0,
    "iva_10_5": 0,
    "iva_5": 0,
    "iva_2_5": 0,
    "otros_tributos": 0,
    "percepciones_iva": 0,
    "percepciones_iibb": 0,
    "retenciones_iva": 0,
    "retenciones_ganancias": 0,
    "retenciones_iibb": 0,
    "importe_otros_conceptos": 0,
    "total_factura": 0
  },
  
  "pago": {
    "forma_pago": "",
    "condicion_venta": "Contado/Cuenta Corriente",
    "moneda": "ARS/USD"
  },
  
  "afip": {
    "cae": "",
    "vencimiento_cae": "YYYY-MM-DD",
    "codigo_barras": ""
  },
  
  "observaciones": ""
}

VALIDACIONES CRÍTICAS:
- Si es Factura A: DEBE tener IVA discriminado
- Si es Factura B: IVA incluido en precio
- Verificar que suma de items = subtotal
- Verificar que subtotal + IVA + tributos = total
- Todos los números deben ser números, no strings
- Fechas en formato YYYY-MM-DD

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.
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
    return validateAndNormalizeFacturaData(extractedData)
  } catch (error) {
    console.error('Error en extracción de factura:', error)
    throw new Error(`Error al extraer datos de factura: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Valida y normaliza los datos extraídos
 */
function validateAndNormalizeFacturaData(data: any): FacturaData {
  // Normalizar items
  const items = Array.isArray(data.items) ? data.items.map((item: any) => ({
    codigo_producto: item.codigo_producto || '',
    descripcion: item.descripcion || '',
    cantidad: parseFloat(item.cantidad) || 0,
    unidad_medida: item.unidad_medida || '',
    precio_unitario: parseFloat(item.precio_unitario) || 0,
    bonificacion_porcentaje: parseFloat(item.bonificacion_porcentaje) || 0,
    subtotal_sin_iva: parseFloat(item.subtotal_sin_iva) || 0,
    alicuota_iva: parseFloat(item.alicuota_iva) || 0,
    total_item: parseFloat(item.total_item) || 0,
  })) : []

  // Normalizar totales
  const totales = {
    subtotal: parseFloat(data.totales?.subtotal) || 0,
    iva_21: parseFloat(data.totales?.iva_21) || 0,
    iva_10_5: parseFloat(data.totales?.iva_10_5) || 0,
    iva_5: parseFloat(data.totales?.iva_5) || 0,
    iva_2_5: parseFloat(data.totales?.iva_2_5) || 0,
    otros_tributos: parseFloat(data.totales?.otros_tributos) || 0,
    percepciones_iva: parseFloat(data.totales?.percepciones_iva) || 0,
    percepciones_iibb: parseFloat(data.totales?.percepciones_iibb) || 0,
    retenciones_iva: parseFloat(data.totales?.retenciones_iva) || 0,
    retenciones_ganancias: parseFloat(data.totales?.retenciones_ganancias) || 0,
    retenciones_iibb: parseFloat(data.totales?.retenciones_iibb) || 0,
    importe_otros_conceptos: parseFloat(data.totales?.importe_otros_conceptos) || 0,
    total_factura: parseFloat(data.totales?.total_factura) || 0,
  }

  return {
    tipo_comprobante: data.tipo_comprobante || '',
    numero_completo: data.numero_completo || '',
    punto_venta: data.punto_venta || '',
    numero: data.numero || '',
    fecha_emision: data.fecha_emision || '',
    fecha_vencimiento: data.fecha_vencimiento,
    emisor: {
      razon_social: data.emisor?.razon_social || '',
      nombre_fantasia: data.emisor?.nombre_fantasia,
      cuit: data.emisor?.cuit || '',
      domicilio_completo: data.emisor?.domicilio_completo,
      localidad: data.emisor?.localidad,
      provincia: data.emisor?.provincia,
      condicion_iva: data.emisor?.condicion_iva,
      inicio_actividades: data.emisor?.inicio_actividades,
    },
    receptor: data.receptor ? {
      razon_social: data.receptor.razon_social || '',
      cuit: data.receptor.cuit || '',
      domicilio: data.receptor.domicilio || '',
      condicion_iva: data.receptor.condicion_iva || '',
    } : undefined,
    items,
    totales,
    pago: data.pago ? {
      forma_pago: data.pago.forma_pago,
      condicion_venta: data.pago.condicion_venta,
      moneda: data.pago.moneda,
    } : undefined,
    afip: data.afip ? {
      cae: data.afip.cae,
      vencimiento_cae: data.afip.vencimiento_cae,
      codigo_barras: data.afip.codigo_barras,
    } : undefined,
    observaciones: data.observaciones,
  }
}

