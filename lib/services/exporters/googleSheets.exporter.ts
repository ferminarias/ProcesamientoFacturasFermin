import { google } from 'googleapis'
import { DocumentType, ExtractedData, FacturaData, ServicioData, ImpuestoData, TarjetaData } from '@/shared/types/document.types'

/**
 * Exporta documentos a Google Sheets
 */
export class GoogleSheetsExporter {
  private auth: any
  private sheets: any

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2()
    this.auth.setCredentials({ access_token: accessToken })
    this.sheets = google.sheets({ version: 'v4', auth: this.auth })
  }

  /**
   * Exporta un documento a Google Sheets
   */
  async exportDocument(
    spreadsheetId: string,
    documentType: DocumentType,
    data: ExtractedData
  ): Promise<void> {
    switch (documentType) {
      case DocumentType.FACTURA_A:
      case DocumentType.FACTURA_B:
      case DocumentType.FACTURA_C:
      case DocumentType.FACTURA_E:
      case DocumentType.FACTURA_M:
        await this.exportFactura(spreadsheetId, documentType, data as FacturaData)
        break
      
      case DocumentType.SERVICIO_LUZ:
      case DocumentType.SERVICIO_GAS:
      case DocumentType.SERVICIO_AGUA:
      case DocumentType.SERVICIO_INTERNET:
      case DocumentType.SERVICIO_TELEFONIA:
      case DocumentType.SERVICIO_CABLE:
        await this.exportServicio(spreadsheetId, documentType, data as ServicioData)
        break
      
      case DocumentType.IMPUESTO_ARBA:
      case DocumentType.IMPUESTO_ABL:
      case DocumentType.IMPUESTO_PATENTE:
      case DocumentType.IMPUESTO_IIBB:
      case DocumentType.IMPUESTO_MONOTRIBUTO:
      case DocumentType.IMPUESTO_GANANCIAS:
        await this.exportImpuesto(spreadsheetId, documentType, data as ImpuestoData)
        break
      
      case DocumentType.RESUMEN_TARJETA:
        await this.exportTarjeta(spreadsheetId, data as TarjetaData)
        break
      
      default:
        throw new Error(`Tipo de documento no soportado: ${documentType}`)
    }
  }

  /**
   * Exporta una factura
   */
  private async exportFactura(
    spreadsheetId: string,
    documentType: DocumentType,
    data: FacturaData
  ): Promise<void> {
    // Determinar la hoja según el tipo
    const sheetName = this.getFacturaSheetName(documentType)
    
    // Crear hoja si no existe
    await this.createSheetIfNotExists(spreadsheetId, sheetName)

    // Preparar datos para la fila
    const row = [
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
    ]

    // Agregar fila
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row],
      },
    })

    // Si hay items, exportarlos a hoja de items detallados
    if (data.items.length > 0) {
      await this.exportFacturaItems(spreadsheetId, data)
    }
  }

  /**
   * Exporta items de factura a hoja detallada
   */
  private async exportFacturaItems(
    spreadsheetId: string,
    data: FacturaData
  ): Promise<void> {
    const sheetName = 'Items detallados'
    await this.createSheetIfNotExists(spreadsheetId, sheetName)

    const rows = data.items.map(item => [
      data.fecha_emision,
      data.numero_completo,
      data.emisor.razon_social,
      item.descripcion,
      item.cantidad,
      item.precio_unitario,
      item.total_item,
    ])

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: rows,
      },
    })
  }

  /**
   * Exporta un servicio
   */
  private async exportServicio(
    spreadsheetId: string,
    documentType: DocumentType,
    data: ServicioData
  ): Promise<void> {
    const sheetName = this.getServicioSheetName(data.tipo_servicio)
    await this.createSheetIfNotExists(spreadsheetId, sheetName)

    const row = [
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
    ]

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row],
      },
    })
  }

  /**
   * Exporta un impuesto
   */
  private async exportImpuesto(
    spreadsheetId: string,
    documentType: DocumentType,
    data: ImpuestoData
  ): Promise<void> {
    const sheetName = 'Impuestos'
    await this.createSheetIfNotExists(spreadsheetId, sheetName)

    const row = [
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
    ]

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row],
      },
    })
  }

  /**
   * Exporta un resumen de tarjeta
   */
  private async exportTarjeta(
    spreadsheetId: string,
    data: TarjetaData
  ): Promise<void> {
    const sheetName = 'Tarjetas'
    await this.createSheetIfNotExists(spreadsheetId, sheetName)

    const row = [
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
    ]

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row],
      },
    })

    // Exportar consumos detallados
    if (data.consumos.length > 0) {
      await this.exportTarjetaConsumos(spreadsheetId, data)
    }
  }

  /**
   * Exporta consumos de tarjeta
   */
  private async exportTarjetaConsumos(
    spreadsheetId: string,
    data: TarjetaData
  ): Promise<void> {
    const sheetName = 'Consumos Tarjeta'
    await this.createSheetIfNotExists(spreadsheetId, sheetName)

    const rows = data.consumos.map(consumo => [
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

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: rows,
      },
    })
  }

  /**
   * Crea una hoja si no existe
   */
  private async createSheetIfNotExists(
    spreadsheetId: string,
    sheetName: string
  ): Promise<void> {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId,
      })

      const sheetExists = spreadsheet.data.sheets?.some(
        (sheet: any) => sheet.properties.title === sheetName
      )

      if (!sheetExists) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        })

        // Agregar headers según el tipo de hoja
        await this.addHeaders(spreadsheetId, sheetName)
      }
    } catch (error) {
      console.error('Error creando hoja:', error)
      throw error
    }
  }

  /**
   * Agrega headers a una hoja
   */
  private async addHeaders(
    spreadsheetId: string,
    sheetName: string
  ): Promise<void> {
    let headers: string[] = []

    if (sheetName.includes('Factura')) {
      headers = [
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
      ]
    } else if (sheetName === 'Items detallados') {
      headers = [
        'Fecha',
        'Número Factura',
        'Emisor',
        'Descripción',
        'Cantidad',
        'Precio Unitario',
        'Total',
      ]
    } else if (['Luz', 'Gas', 'Agua', 'Internet', 'Teléfono'].includes(sheetName)) {
      headers = [
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
      ]
    } else if (sheetName === 'Impuestos') {
      headers = [
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
      ]
    } else if (sheetName === 'Tarjetas') {
      headers = [
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
      ]
    } else if (sheetName === 'Consumos Tarjeta') {
      headers = [
        'Fecha Cierre',
        'Banco',
        'Número Tarjeta',
        'Fecha Consumo',
        'Comercio',
        'Descripción',
        'Cuota',
        'Importe Pesos',
        'Importe Dólares',
      ]
    }

    if (headers.length > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers],
        },
      })

      // Formatear headers en negrita
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: await this.getSheetId(spreadsheetId, sheetName),
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                    },
                  },
                },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            },
          ],
        },
      })
    }
  }

  /**
   * Obtiene el ID de una hoja
   */
  private async getSheetId(
    spreadsheetId: string,
    sheetName: string
  ): Promise<number> {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId,
    })

    const sheet = spreadsheet.data.sheets?.find(
      (sheet: any) => sheet.properties.title === sheetName
    )

    return sheet?.properties.sheetId || 0
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

