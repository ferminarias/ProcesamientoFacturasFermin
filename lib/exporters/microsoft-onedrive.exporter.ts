import { Client } from '@microsoft/microsoft-graph-client';
import ExcelJS from 'exceljs';

interface OneDriveExporterOptions {
  accessToken: string;
  refreshToken?: string;
}

export class MicrosoftOneDriveExporter {
  private client: Client;
  private accessToken: string;
  private refreshToken?: string;

  constructor(options: OneDriveExporterOptions) {
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;

    // Inicializar cliente de Microsoft Graph
    this.client = Client.init({
      authProvider: (done) => {
        done(null, this.accessToken);
      },
    });
  }

  /**
   * Exporta documentos a un archivo Excel en OneDrive
   */
  async exportToOneDrive(documents: any[], fileName: string = 'documentos_procesados.xlsx') {
    try {
      // Crear workbook de Excel
      const workbook = new ExcelJS.Workbook();

      // Agrupar documentos por tipo
      const documentsByType = this.groupDocumentsByType(documents);

      // Crear una hoja por cada tipo de documento
      for (const [type, docs] of Object.entries(documentsByType)) {
        const worksheet = workbook.addWorksheet(type);

        if (docs.length === 0) continue;

        // Obtener campos del primer documento
        const firstDoc = docs[0].extractedData || {};
        const headers = Object.keys(firstDoc);

        // Agregar headers
        worksheet.addRow(['Archivo', 'Fecha de procesamiento', ...headers]);

        // Agregar datos
        docs.forEach((doc: any) => {
          const data = doc.extractedData || {};
          const row = [
            doc.fileName,
            new Date(doc.createdAt).toLocaleDateString('es-AR'),
            ...headers.map((key) => data[key] || ''),
          ];
          worksheet.addRow(row);
        });

        // Auto-ajustar columnas
        worksheet.columns.forEach((column: any) => {
          let maxLength = 0;
          column.eachCell?.({ includeEmpty: true }, (cell: any) => {
            const cellLength = cell.value ? cell.value.toString().length : 10;
            if (cellLength > maxLength) {
              maxLength = cellLength;
            }
          });
          column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Formatear headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      }

      // Convertir workbook a buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Subir archivo a OneDrive
      const uploadResponse = await this.client
        .api(`/me/drive/root:/${fileName}:/content`)
        .put(buffer);

      return {
        success: true,
        fileId: uploadResponse.id,
        fileName: uploadResponse.name,
        webUrl: uploadResponse.webUrl,
        message: 'Archivo exportado exitosamente a OneDrive',
      };
    } catch (error) {
      console.error('Error exporting to OneDrive:', error);
      throw new Error('Error al exportar a OneDrive');
    }
  }

  /**
   * Crea una carpeta en OneDrive
   */
  async createFolder(folderName: string) {
    try {
      const folder = await this.client.api('/me/drive/root/children').post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      });

      return {
        success: true,
        folderId: folder.id,
        folderName: folder.name,
      };
    } catch (error) {
      console.error('Error creating folder in OneDrive:', error);
      throw new Error('Error al crear carpeta en OneDrive');
    }
  }

  /**
   * Lista archivos en OneDrive
   */
  async listFiles(folderId?: string) {
    try {
      const endpoint = folderId
        ? `/me/drive/items/${folderId}/children`
        : '/me/drive/root/children';

      const response = await this.client.api(endpoint).get();

      return response.value.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        webUrl: file.webUrl,
        createdAt: file.createdDateTime,
        modifiedAt: file.lastModifiedDateTime,
        isFolder: !!file.folder,
      }));
    } catch (error) {
      console.error('Error listing files from OneDrive:', error);
      throw new Error('Error al listar archivos de OneDrive');
    }
  }

  /**
   * Descarga un archivo de OneDrive
   */
  async downloadFile(fileId: string) {
    try {
      const response = await this.client.api(`/me/drive/items/${fileId}/content`).get();

      return response;
    } catch (error) {
      console.error('Error downloading file from OneDrive:', error);
      throw new Error('Error al descargar archivo de OneDrive');
    }
  }

  /**
   * Agrupa documentos por tipo
   */
  private groupDocumentsByType(documents: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    documents.forEach((doc) => {
      const type = doc.classification?.type || 'Sin clasificar';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(doc);
    });

    return groups;
  }
}
