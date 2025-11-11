// Tipos compartidos para documentos financieros argentinos

export enum DocumentType {
  FACTURA_A = 'FACTURA_A',
  FACTURA_B = 'FACTURA_B',
  FACTURA_C = 'FACTURA_C',
  FACTURA_E = 'FACTURA_E',
  FACTURA_M = 'FACTURA_M',
  SERVICIO_LUZ = 'SERVICIO_LUZ',
  SERVICIO_GAS = 'SERVICIO_GAS',
  SERVICIO_AGUA = 'SERVICIO_AGUA',
  SERVICIO_INTERNET = 'SERVICIO_INTERNET',
  SERVICIO_TELEFONIA = 'SERVICIO_TELEFONIA',
  SERVICIO_CABLE = 'SERVICIO_CABLE',
  IMPUESTO_ARBA = 'IMPUESTO_ARBA',
  IMPUESTO_ABL = 'IMPUESTO_ABL',
  IMPUESTO_PATENTE = 'IMPUESTO_PATENTE',
  IMPUESTO_IIBB = 'IMPUESTO_IIBB',
  IMPUESTO_MONOTRIBUTO = 'IMPUESTO_MONOTRIBUTO',
  IMPUESTO_GANANCIAS = 'IMPUESTO_GANANCIAS',
  RESUMEN_TARJETA = 'RESUMEN_TARJETA',
  OTRO = 'OTRO',
}

export enum DocumentStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  CLASSIFYING = 'CLASSIFYING',
  EXTRACTING = 'EXTRACTING',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EDITED = 'EDITED',
}

// Resultado de clasificación
export interface ClassificationResult {
  tipo_documento: DocumentType;
  subtipo: string;
  confianza: number; // 0-100
  razon_clasificacion: string;
}

// Estructura de datos extraídos de una Factura
export interface FacturaData {
  tipo_comprobante: string;
  numero_completo: string;
  punto_venta: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  
  emisor: {
    razon_social: string;
    nombre_fantasia?: string;
    cuit: string;
    domicilio_completo?: string;
    localidad?: string;
    provincia?: string;
    condicion_iva?: string;
    inicio_actividades?: string;
  };
  
  receptor?: {
    razon_social: string;
    cuit: string;
    domicilio?: string;
    condicion_iva?: string;
  };
  
  items: Array<{
    codigo_producto?: string;
    descripcion: string;
    cantidad: number;
    unidad_medida?: string;
    precio_unitario: number;
    bonificacion_porcentaje?: number;
    subtotal_sin_iva: number;
    alicuota_iva?: number;
    total_item: number;
  }>;
  
  totales: {
    subtotal: number;
    iva_21?: number;
    iva_10_5?: number;
    iva_5?: number;
    iva_2_5?: number;
    otros_tributos?: number;
    percepciones_iva?: number;
    percepciones_iibb?: number;
    retenciones_iva?: number;
    retenciones_ganancias?: number;
    retenciones_iibb?: number;
    importe_otros_conceptos?: number;
    total_factura: number;
  };
  
  pago?: {
    forma_pago?: string;
    condicion_venta?: string;
    moneda?: string;
  };
  
  afip?: {
    cae?: string;
    vencimiento_cae?: string;
    codigo_barras?: string;
  };
  
  observaciones?: string;
}

// Estructura de datos extraídos de un Servicio
export interface ServicioData {
  tipo_servicio: 'luz' | 'gas' | 'agua' | 'internet' | 'telefonia' | 'cable';
  empresa_proveedora: string;
  numero_cuenta: string;
  numero_medidor?: string;
  titular: string;
  domicilio_suministro: string;
  
  periodo_facturado: {
    fecha_desde: string;
    fecha_hasta: string;
    dias_facturados: number;
  };
  
  consumo?: {
    lectura_anterior: number;
    lectura_actual: number;
    consumo_unidades: number;
    unidad_medida: string;
    precio_unitario: number;
  };
  
  cargos: Array<{
    concepto: string;
    descripcion: string;
    importe: number;
  }>;
  
  totales: {
    subtotal: number;
    iva: number;
    impuestos_municipales?: number;
    otros_cargos?: number;
    total_a_pagar: number;
  };
  
  vencimientos: {
    primer_vencimiento: string;
    segundo_vencimiento?: string;
    recargo_segundo_venc?: number;
  };
  
  datos_pago?: {
    codigo_pago_electronico?: string;
    codigo_barras?: string;
  };
}

// Estructura de datos extraídos de un Impuesto
export interface ImpuestoData {
  tipo_impuesto: 'arba' | 'abl' | 'patente' | 'iibb' | 'monotributo' | 'ganancias';
  organismo_recaudador: string;
  jurisdiccion: string;
  contribuyente: string;
  cuit_cuil: string;
  domicilio: string;
  
  liquidacion: {
    numero_partida?: string;
    numero_liquidacion: string;
    periodo_fiscal: string;
    año_fiscal: number;
    anticipo_cuota?: string;
  };
  
  deuda: {
    capital: number;
    intereses?: number;
    recargos?: number;
    total_deuda: number;
  };
  
  vencimientos: Array<{
    cuota?: string;
    fecha_vencimiento: string;
    importe: number;
    descuento_pago_adelantado?: number;
  }>;
  
  datos_pago?: {
    codigo_pago_electronico?: string;
    cbu_debito_automatico?: string;
  };
}

// Estructura de datos extraídos de un Resumen de Tarjeta
export interface TarjetaData {
  banco_emisor: string;
  tipo_tarjeta: 'visa' | 'mastercard' | 'amex' | 'cabal' | 'naranja';
  numero_tarjeta_enmascarado: string;
  titular: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  
  resumen_anterior?: {
    saldo_anterior: number;
    pago_anterior: number;
    ajustes?: number;
  };
  
  consumos: Array<{
    fecha: string;
    comercio: string;
    descripcion: string;
    cuota?: string;
    importe_pesos: number;
    importe_dolares?: number;
  }>;
  
  totales: {
    total_consumos: number;
    intereses?: number;
    cargos_servicios?: number;
    impuestos?: number;
    total_resumen: number;
    pago_minimo: number;
    pago_total_sin_interes: number;
  };
  
  cuotas_vigentes?: Array<{
    descripcion: string;
    cuota_actual: string;
    importe_cuota: number;
  }>;
}

// Tipo union para todos los datos extraídos
export type ExtractedData = FacturaData | ServicioData | ImpuestoData | TarjetaData;

// Job en la cola de procesamiento
export interface ProcessingJob {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  status: DocumentStatus;
  documentType?: DocumentType;
  extractedData?: ExtractedData;
  validationStatus?: ValidationStatus;
  retryCount: number;
  createdAt: Date;
  processedAt?: Date;
  errorMessage?: string;
}

// Feedback de corrección
export interface DocumentCorrection {
  field: string;
  originalValue: any;
  correctedValue: any;
  correctionType: 'typo' | 'missing' | 'incorrect' | 'format';
}

export interface DocumentFeedback {
  documentId: string;
  corrections: DocumentCorrection[];
  documentType: DocumentType;
  supplier?: string;
  timestamp: Date;
}

