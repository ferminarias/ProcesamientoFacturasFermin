import ExcelJS from 'exceljs'
import { DocumentType, ExtractedData, FacturaData, ServicioData, ImpuestoData, TarjetaData } from '@/shared/types/document.types'

/**
 * Exporta documentos a Excel
 */
export class ExcelExporter {
  private workbook: ExcelJS.Workbook

  constructor() {
    this.workbook = new ExcelJS.Workbook()
  }

  /**
   * Exporta un documento a Excel
   */
  async exportDocument(
    documentType: DocumentType,
    data: ExtractedData
  ): Promise<Buffer> {
    switch (documentType) {
      case DocumentType.FACTURA_A:
      case DocumentType.FACTURA_B:
      case DocumentType.FACTURA_C:
      case DocumentType.FACTURA_E:
      case DocumentType.FACTURA_M:
        await this.exportFactura(documentType, data as FacturaData)
        break
      
      case DocumentType.SERVICIO_LUZ:
      case DocumentType.SERVICIO_GAS:
      case DocumentType.SERVICIO_AGUA:
      case DocumentType.SERVICIO_INTERNET:
      case DocumentType.SERVICIO_TELEFONIA:
      case DocumentType.SERVICIO_CABLE:
        await this.exportServicio(documentType, data as ServicioData)
        break
      
      case DocumentType.IMPUESTO_ARBA:
      case DocumentType.IMPUESTO_ABL:
      case DocumentType.IMPUESTO_PATENTE:
      case DocumentType.IMPUESTO_IIBB:
      case DocumentType.IMPUESTO_MONOTRIBUTO:
      case DocumentType.IMPUESTO_GANANCIAS:
        await this.exportImpuesto(documentType, data as ImpuestoData)
        break
      
      case DocumentType.RESUMEN_TARJETA:
        await this.exportTarjeta(data as TarjetaData)
        break
      
      default:
        throw new Error(`Tipo de documento no soportado: ${documentType}`)
    }

    // Generar buffer
    const buffer = await this.workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  /**
   * Exporta una factura
   */
  private async exportFactura(
    documentType: DocumentType,
    data: FacturaData
  ): Promise<void> {
    const sheetName = this.getFacturaSheetName(documentType)
    let worksheet = this.workbook.getWorksheet(sheetName)

    if (!worksheet) {
      worksheet = this.workbook.addWorksheet(sheetName)
      this.addFacturaHeaders(worksheet)
    }

    // Agregar fila de datos
    worksheet.addRow([
      data.fecha_emision,
      data.numero_completo,
      data.emisor.razon_social,
      data.emisor.cuit,
      data.receptor?.razon_social || '',
      data.receptor?.cuit || '',
      data.items.length,
      data.totales.subtotal,
      data.totales.iva_21 || 0,
      data.totales.total_factura,
      data.afip?.cae || '',
      data.observaciones || '',
    ])

    // Exportar items si existen
    if (data.items.length > 0) {
      await this.exportFacturaItems(data)
    }
  }

  /**
   * Agrega headers para facturas
   */
  private addFacturaHeaders(worksheet: ExcelJS.Worksheet): void {
    worksheet.addRow([
      'Fecha',
      'Número',
      'Emisor',
      'CUIT Emisor',
      'Receptor',
      'CUIT Receptor',
      'Cantidad Items',
      'Subtotal',
      'IVA 21%',
      'Total',
      'CAE',
      'Observaciones',
    ])

    // Formatear headers
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
  }

  /**
   * Exporta items de factura
   */
  private async exportFacturaItems(data: FacturaData): Promise<void> {
    let worksheet = this.workbook.getWorksheet('Items detallados')

    if (!worksheet) {
      worksheet = this.workbook.addWorksheet('Items detallados')
      worksheet.addRow([
        'Fecha',
        'Número Factura',
        'Emisor',
        'Descripción',
        'Cantidad',
        'Precio Unitario',
        'Total',
      ])

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
    }

    // Agregar items
    data.items.forEach(item => {
      worksheet.addRow([
        data.fecha_emision,
        data.numero_completo,
        data.emisor.razon_social,
        item.descripcion,
        item.cantidad,
        item.precio_unitario,
        item.total_item,
      ])
    })
  }

  /**
   * Exporta un servicio
   */
  private async exportServicio(
    documentType: DocumentType,
    data: ServicioData
  ): Promise<void> {
    const sheetName = this.getServicioSheetName(data.tipo_servicio)
    let worksheet = this.workbook.getWorksheet(sheetName)

    if (!worksheet) {
      worksheet = this.workbook.addWorksheet(sheetName)
      worksheet.addRow([
        'Período Desde',
        'Período Hasta',
        'Empresa',
        'Número Cuenta',
        'Titular',
        'Consumo',
        'Subtotal',
        'IVA',
        'Total a Pagar',
        'Vencimiento 1',
        'Vencimiento 2',
      ])

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
    }

    worksheet.addRow([
      data.periodo_facturado.fecha_desde,
      data.periodo_facturado.fecha_hasta,
      data.empresa_proveedora,
      data.numero_cuenta,
      data.titular,
      data.consumo?.consumo_unidades || 0,
      data.totales.subtotal,
      data.totales.iva,
      data.totales.total_a_pagar,
      data.vencimientos.primer_vencimiento,
      data.vencimientos.segundo_vencimiento || '',
    ])
  }

  /**
   * Exporta un impuesto
   */
  private async exportImpuesto(
    documentType: DocumentType,
    data: ImpuestoData
  ): Promise<void> {
    let worksheet = this.workbook.getWorksheet('Impuestos')

    if (!worksheet) {
      worksheet = this.workbook.addWorksheet('Impuestos')
      worksheet.addRow([
        'Período Fiscal',
        'Tipo Impuesto',
        'Organismo',
        'Contribuyente',
        'Número Liquidación',
        'Capital',
        'Intereses',
        'Total Deuda',
        'Vencimiento',
        'Importe',
      ])

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
    }

    worksheet.addRow([
      data.liquidacion.periodo_fiscal,
      data.tipo_impuesto,
      data.organismo_recaudador,
      data.contribuyente,
      data.liquidacion.numero_liquidacion,
      data.deuda.capital,
      data.deuda.intereses || 0,
      data.deuda.total_deuda,
      data.vencimientos[0]?.fecha_vencimiento || '',
      data.vencimientos[0]?.importe || 0,
    ])
  }

  /**
   * Exporta un resumen de tarjeta
   */
  private async exportTarjeta(data: TarjetaData): Promise<void> {
    let worksheet = this.workbook.getWorksheet('Tarjetas')

    if (!worksheet) {
      worksheet = this.workbook.addWorksheet('Tarjetas')
      worksheet.addRow([
        'Fecha Cierre',
        'Fecha Vencimiento',
        'Banco',
        'Tipo Tarjeta',
        'Número Tarjeta',
        'Total Consumos',
        'Total Resumen',
        'Pago Mínimo',
        'Pago Total Sin Interés',
        'Cantidad Consumos',
      ])

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
    }

    worksheet.addRow([
      data.fecha_cierre,
      data.fecha_vencimiento,
      data.banco_emisor,
      data.tipo_tarjeta,
      data.numero_tarjeta_enmascarado,
      data.totales.total_consumos,
      data.totales.total_resumen,
      data.totales.pago_minimo,
      data.totales.pago_total_sin_interes,
      data.consumos.length,
    ])

    // Exportar consumos
    if (data.consumos.length > 0) {
      await this.exportTarjetaConsumos(data)
    }
  }

  /**
   * Exporta consumos de tarjeta
   */
  private async exportTarjetaConsumos(data: TarjetaData): Promise<void> {
    let worksheet = this.workbook.getWorksheet('Consumos Tarjeta')

    if (!worksheet) {
      worksheet = this.workbook.addWorksheet('Consumos Tarjeta')
      worksheet.addRow([
        'Fecha Cierre',
        'Banco',
        'Número Tarjeta',
        'Fecha Consumo',
        'Comercio',
        'Descripción',
        'Cuota',
        'Importe Pesos',
        'Importe Dólares',
      ])

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
    }

    data.consumos.forEach(consumo => {
      worksheet.addRow([
        data.fecha_cierre,
        data.banco_emisor,
        data.numero_tarjeta_enmascarado,
        consumo.fecha,
        consumo.comercio,
        consumo.descripcion,
        consumo.cuota || '',
        consumo.importe_pesos,
        consumo.importe_dolares || 0,
      ])
    })
  }

  /**
   * Obtiene el nombre de la hoja para facturas
   */
  private getFacturaSheetName(documentType: DocumentType): string {
    const mapping: Record<string, string> = {
      [DocumentType.FACTURA_A]: 'Facturas A',
      [DocumentType.FACTURA_B]: 'Facturas B',
      [DocumentType.FACTURA_C]: 'Facturas C',
      [DocumentType.FACTURA_E]: 'Facturas E',
      [DocumentType.FACTURA_M]: 'Facturas M',
    }
    return mapping[documentType] || 'Facturas'
  }

  /**
   * Obtiene el nombre de la hoja para servicios
   */
  private getServicioSheetName(tipoServicio: string): string {
    const mapping: Record<string, string> = {
      luz: 'Luz',
      gas: 'Gas',
      agua: 'Agua',
      internet: 'Internet',
      telefonia: 'Teléfono',
      cable: 'Cable',
    }
    return mapping[tipoServicio] || 'Servicios'
  }
}

