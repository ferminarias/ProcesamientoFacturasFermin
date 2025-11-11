import OpenAI from 'openai';
import { env } from '@/lib/config/env';
import { DocumentType } from '@prisma/client';
import {
  getLearnedConfiguration,
  getLearningRules,
  applyLearningRules,
  buildCustomPrompt,
  markConfigurationSuccess,
  ExtractionContext,
} from '@/lib/services/learning.service';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Extractor adaptativo que aprende de correcciones de usuario
 *
 * Funcionalidades:
 * - Usa configuraciones aprendidas por proveedor
 * - Aplica reglas de transformación basadas en feedback
 * - Construye prompts personalizados
 * - Registra éxitos para mejorar precisión
 */

export interface AdaptiveExtractionOptions {
  imageUrl: string;
  basePrompt: string;
  context: ExtractionContext;
  maxTokens?: number;
  model?: string;
}

/**
 * Extrae datos de un documento usando aprendizaje adaptativo
 */
export async function extractWithLearning<T>(
  options: AdaptiveExtractionOptions
): Promise<{ data: T; configId?: string }> {
  const {
    imageUrl,
    basePrompt,
    context,
    maxTokens = 4000,
    model = 'gpt-4o',
  } = options;

  try {
    // 1. Obtener configuración aprendida para este proveedor/tipo
    console.log('[AdaptiveExtractor] Buscando configuración aprendida...');
    const config = await getLearnedConfiguration(context);

    // 2. Construir prompt personalizado con instrucciones aprendidas
    const customizedPrompt = buildCustomPrompt(basePrompt, config);

    console.log('[AdaptiveExtractor] Ejecutando extracción con Vision LLM...');

    // 3. Ejecutar extracción con GPT-4o Vision
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: customizedPrompt },
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
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });

    const extractedData = JSON.parse(response.choices[0].message.content || '{}');

    // 4. Aplicar reglas de aprendizaje a los datos extraídos
    let transformedData = extractedData;

    if (config) {
      console.log('[AdaptiveExtractor] Aplicando reglas de aprendizaje...');
      const rules = await getLearningRules(context, config.id);

      if (rules.length > 0) {
        transformedData = applyLearningRules(extractedData, rules, config);
        console.log(`[AdaptiveExtractor] Aplicadas ${rules.length} reglas de transformación`);
      }

      // 5. Marcar configuración como exitosa
      await markConfigurationSuccess(config.id);
    }

    return {
      data: transformedData as T,
      configId: config?.id,
    };
  } catch (error) {
    console.error('[AdaptiveExtractor] Error en extracción adaptativa:', error);
    throw error;
  }
}

/**
 * Detecta información del proveedor desde datos extraídos
 * Útil para crear contexto cuando no se conoce el proveedor de antemano
 */
export function detectSupplierInfo(extractedData: any): { name?: string; cuit?: string } {
  const data = extractedData || {};

  // Intentar detectar CUIT del emisor
  const cuit =
    data.emisor?.cuit ||
    data.emisor_cuit ||
    data.cuit ||
    data.empresa_cuit ||
    data.banco_cuit ||
    data.proveedor_cuit;

  // Intentar detectar nombre del proveedor
  const name =
    data.emisor?.nombre ||
    data.emisor_nombre ||
    data.empresa ||
    data.empresa_proveedora ||
    data.banco_emisor ||
    data.comercio ||
    data.proveedor;

  return {
    cuit: typeof cuit === 'string' ? cuit.replace(/[^0-9]/g, '') : undefined,
    name: typeof name === 'string' ? name : undefined,
  };
}

/**
 * Guarda datos extraídos en tabla especializada según el tipo de documento
 */
export async function saveToSpecializedTable(
  documentId: string,
  tenantId: string,
  documentType: DocumentType,
  extractedData: any,
  prisma: any
) {
  try {
    switch (documentType) {
      case DocumentType.FACTURA_A:
      case DocumentType.FACTURA_B:
      case DocumentType.FACTURA_C:
      case DocumentType.FACTURA_E:
      case DocumentType.FACTURA_M:
        await saveFactura(documentId, tenantId, extractedData, prisma);
        break;

      case DocumentType.RESUMEN_TARJETA:
        await saveResumenTarjeta(documentId, tenantId, extractedData, prisma);
        break;

      case DocumentType.SERVICIO_LUZ:
      case DocumentType.SERVICIO_GAS:
      case DocumentType.SERVICIO_AGUA:
      case DocumentType.SERVICIO_INTERNET:
      case DocumentType.SERVICIO_TELEFONIA:
      case DocumentType.SERVICIO_CABLE:
        await saveServicio(documentId, tenantId, extractedData, prisma);
        break;

      case DocumentType.IMPUESTO_ARBA:
      case DocumentType.IMPUESTO_ABL:
      case DocumentType.IMPUESTO_PATENTE:
      case DocumentType.IMPUESTO_IIBB:
      case DocumentType.IMPUESTO_MONOTRIBUTO:
      case DocumentType.IMPUESTO_GANANCIAS:
        await saveImpuesto(documentId, tenantId, extractedData, prisma);
        break;

      case DocumentType.OTRO:
        await saveTicket(documentId, tenantId, extractedData, prisma);
        break;

      default:
        console.log(`[AdaptiveExtractor] No hay tabla especializada para ${documentType}`);
    }
  } catch (error) {
    console.error('[AdaptiveExtractor] Error guardando en tabla especializada:', error);
    throw error;
  }
}

// ============================================================================
// FUNCIONES DE GUARDADO POR TIPO DE DOCUMENTO
// ============================================================================

async function saveFactura(documentId: string, tenantId: string, data: any, prisma: any) {
  const fechaEmision = data.fecha_emision ? new Date(data.fecha_emision) : null;
  const vencimientoCae = data.vencimiento_cae ? new Date(data.vencimiento_cae) : null;

  await prisma.factura.create({
    data: {
      documentId,
      tenantId,
      tipo: data.tipo || '',
      numero: data.numero || '',
      punto_venta: data.punto_venta,
      fecha_emision: fechaEmision,
      emisor_nombre: data.emisor?.nombre || data.emisor_nombre,
      emisor_cuit: data.emisor?.cuit || data.emisor_cuit,
      emisor_direccion: data.emisor?.direccion || data.emisor_direccion,
      emisor_condicion_iva: data.emisor?.condicion_iva || data.emisor_condicion_iva,
      receptor_nombre: data.receptor?.nombre || data.receptor_nombre,
      receptor_cuit: data.receptor?.cuit || data.receptor_cuit,
      receptor_direccion: data.receptor?.direccion || data.receptor_direccion,
      receptor_condicion_iva: data.receptor?.condicion_iva || data.receptor_condicion_iva,
      items: data.items || [],
      subtotal: parseFloat(data.subtotal || data.totales?.subtotal || 0),
      iva_105: parseFloat(data.iva_105 || data.totales?.iva_105 || 0),
      iva_21: parseFloat(data.iva_21 || data.totales?.iva_21 || 0),
      iva_27: parseFloat(data.iva_27 || data.totales?.iva_27 || 0),
      otros_impuestos: parseFloat(data.otros_impuestos || data.totales?.otros_impuestos || 0),
      total: parseFloat(data.total || data.totales?.total || 0),
      cae: data.cae,
      vencimiento_cae: vencimientoCae,
      codigo_barras: data.codigo_barras,
      qr_data: data.qr_data,
    },
  });
}

async function saveResumenTarjeta(documentId: string, tenantId: string, data: any, prisma: any) {
  const fechaCierre = data.fecha_cierre ? new Date(data.fecha_cierre) : null;
  const fechaVencimiento = data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : null;

  await prisma.resumenTarjeta.create({
    data: {
      documentId,
      tenantId,
      banco_emisor: data.banco_emisor,
      tipo_tarjeta: data.tipo_tarjeta,
      numero_tarjeta_enmascarado: data.numero_tarjeta_enmascarado,
      titular: data.titular,
      fecha_cierre: fechaCierre,
      fecha_vencimiento: fechaVencimiento,
      saldo_anterior: parseFloat(data.resumen_anterior?.saldo_anterior || 0),
      pago_anterior: parseFloat(data.resumen_anterior?.pago_anterior || 0),
      ajustes: parseFloat(data.resumen_anterior?.ajustes || 0),
      consumos: data.consumos || [],
      total_consumos: parseFloat(data.totales?.total_consumos || 0),
      intereses: parseFloat(data.totales?.intereses || 0),
      cargos_servicios: parseFloat(data.totales?.cargos_servicios || 0),
      impuestos: parseFloat(data.totales?.impuestos || 0),
      total_resumen: parseFloat(data.totales?.total_resumen || 0),
      pago_minimo: parseFloat(data.totales?.pago_minimo || 0),
      pago_total_sin_interes: parseFloat(data.totales?.pago_total_sin_interes || 0),
      cuotas_vigentes: data.cuotas_vigentes,
    },
  });
}

async function saveServicio(documentId: string, tenantId: string, data: any, prisma: any) {
  const fechaDesde = data.periodo_facturado?.fecha_desde || data.fecha_desde
    ? new Date(data.periodo_facturado?.fecha_desde || data.fecha_desde)
    : null;
  const fechaHasta = data.periodo_facturado?.fecha_hasta || data.fecha_hasta
    ? new Date(data.periodo_facturado?.fecha_hasta || data.fecha_hasta)
    : null;
  const primerVencimiento = data.vencimientos?.primer_vencimiento || data.primer_vencimiento
    ? new Date(data.vencimientos?.primer_vencimiento || data.primer_vencimiento)
    : null;
  const segundoVencimiento = data.vencimientos?.segundo_vencimiento || data.segundo_vencimiento
    ? new Date(data.vencimientos?.segundo_vencimiento || data.segundo_vencimiento)
    : null;

  await prisma.servicio.create({
    data: {
      documentId,
      tenantId,
      tipo_servicio: data.tipo_servicio || '',
      empresa_proveedora: data.empresa_proveedora,
      numero_cuenta: data.numero_cuenta,
      numero_medidor: data.numero_medidor,
      titular: data.titular,
      domicilio_suministro: data.domicilio_suministro,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      dias_facturados: parseInt(data.periodo_facturado?.dias_facturados || data.dias_facturados || 0),
      lectura_anterior: parseFloat(data.consumo?.lectura_anterior || 0),
      lectura_actual: parseFloat(data.consumo?.lectura_actual || 0),
      consumo_unidades: parseFloat(data.consumo?.consumo_unidades || 0),
      unidad_medida: data.consumo?.unidad_medida,
      precio_unitario: parseFloat(data.consumo?.precio_unitario || 0),
      cargos: data.cargos || [],
      subtotal: parseFloat(data.totales?.subtotal || 0),
      iva: parseFloat(data.totales?.iva || 0),
      impuestos_municipales: parseFloat(data.totales?.impuestos_municipales || 0),
      otros_cargos: parseFloat(data.totales?.otros_cargos || 0),
      total_a_pagar: parseFloat(data.totales?.total_a_pagar || 0),
      primer_vencimiento: primerVencimiento,
      segundo_vencimiento: segundoVencimiento,
      recargo_segundo_venc: parseFloat(data.vencimientos?.recargo_segundo_venc || 0),
      codigo_pago_electronico: data.datos_pago?.codigo_pago_electronico,
      codigo_barras: data.datos_pago?.codigo_barras,
    },
  });
}

async function saveImpuesto(documentId: string, tenantId: string, data: any, prisma: any) {
  await prisma.impuesto.create({
    data: {
      documentId,
      tenantId,
      tipo_impuesto: data.tipo_impuesto || '',
      organismo_recaudador: data.organismo_recaudador,
      jurisdiccion: data.jurisdiccion,
      contribuyente: data.contribuyente,
      cuit_cuil: data.cuit_cuil,
      domicilio: data.domicilio,
      numero_partida: data.liquidacion?.numero_partida,
      numero_liquidacion: data.liquidacion?.numero_liquidacion,
      periodo_fiscal: data.liquidacion?.periodo_fiscal,
      año_fiscal: parseInt(data.liquidacion?.año_fiscal || new Date().getFullYear()),
      anticipo_cuota: data.liquidacion?.anticipo_cuota,
      capital: parseFloat(data.deuda?.capital || 0),
      intereses: parseFloat(data.deuda?.intereses || 0),
      recargos: parseFloat(data.deuda?.recargos || 0),
      total_deuda: parseFloat(data.deuda?.total_deuda || 0),
      vencimientos: data.vencimientos || [],
      codigo_pago_electronico: data.datos_pago?.codigo_pago_electronico,
      cbu_debito_automatico: data.datos_pago?.cbu_debito_automatico,
    },
  });
}

async function saveTicket(documentId: string, tenantId: string, data: any, prisma: any) {
  const fechaHora = data.fecha_hora ? new Date(data.fecha_hora) : null;

  await prisma.ticket.create({
    data: {
      documentId,
      tenantId,
      comercio: data.comercio,
      direccion: data.direccion,
      telefono: data.telefono,
      cuit: data.cuit,
      numero_ticket: data.numero_ticket,
      fecha_hora: fechaHora,
      items: data.items || [],
      subtotal: parseFloat(data.totales?.subtotal || data.subtotal || 0),
      descuentos: parseFloat(data.totales?.descuentos || data.descuentos || 0),
      recargos: parseFloat(data.totales?.recargos || data.recargos || 0),
      total: parseFloat(data.totales?.total || data.total || 0),
      metodo_pago: data.metodo_pago,
    },
  });
}
