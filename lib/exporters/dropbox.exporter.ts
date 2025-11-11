import { Dropbox } from 'dropbox';
import ExcelJS from 'exceljs';

interface DropboxExporterOptions {
  accessToken: string;
  refreshToken?: string;
}

export class DropboxExporter {
  private client: Dropbox;
  private accessToken: string;
  private refreshToken?: string;

  constructor(options: DropboxExporterOptions) {
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;

    // Inicializar cliente de Dropbox
    this.client = new Dropbox({
      accessToken: this.accessToken,
    });
  }

  /**
   * Exporta documentos a un archivo Excel en Dropbox
   */
  async exportToDropbox(
    documents: any[],
    fileName: string = 'documentos_procesados.xlsx',
    folderPath: string = ''
  ) {
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

      // Subir archivo a Dropbox
      const path = folderPath ? `/${folderPath}/${fileName}` : `/${fileName}`;
      const uploadResponse = await this.client.filesUpload({
        path,
        contents: buffer,
        mode: { '.tag': 'overwrite' },
        autorename: true,
      });

      // Obtener link compartido
      let sharedLink;
      try {
        const linkResponse = await this.client.sharingCreateSharedLinkWithSettings({
          path: uploadResponse.result.path_display || '',
        });
        sharedLink = linkResponse.result.url;
      } catch (error) {
        // Si ya existe un link, obtenerlo
        try {
          const existingLinks = await this.client.sharingListSharedLinks({
            path: uploadResponse.result.path_display || '',
          });
          if (existingLinks.result.links.length > 0) {
            sharedLink = existingLinks.result.links[0].url;
          }
        } catch (e) {
          console.log('No se pudo obtener link compartido:', e);
        }
      }

      return {
        success: true,
        fileName: uploadResponse.result.name,
        path: uploadResponse.result.path_display,
        id: uploadResponse.result.id,
        sharedLink,
        message: 'Archivo exportado exitosamente a Dropbox',
      };
    } catch (error) {
      console.error('Error exporting to Dropbox:', error);
      throw new Error('Error al exportar a Dropbox');
    }
  }

  /**
   * Crea una carpeta en Dropbox
   */
  async createFolder(folderPath: string) {
    try {
      const folder = await this.client.filesCreateFolderV2({
        path: `/${folderPath}`,
        autorename: false,
      });

      return {
        success: true,
        folderPath: folder.result.metadata.path_display,
        folderId: folder.result.metadata.id,
      };
    } catch (error: any) {
      // Si la carpeta ya existe, no es un error
      if (error.error?.error?.['.tag'] === 'path' && error.error?.error?.path?.['.tag'] === 'conflict') {
        return {
          success: true,
          message: 'Carpeta ya existe',
        };
      }
      console.error('Error creating folder in Dropbox:', error);
      throw new Error('Error al crear carpeta en Dropbox');
    }
  }

  /**
   * Lista archivos en Dropbox
   */
  async listFiles(folderPath: string = '') {
    try {
      const response = await this.client.filesListFolder({
        path: folderPath || '',
      });

      return response.result.entries.map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        path: entry.path_display,
        size: entry.size,
        modified: entry.server_modified,
        isFolder: entry['.tag'] === 'folder',
      }));
    } catch (error) {
      console.error('Error listing files from Dropbox:', error);
      throw new Error('Error al listar archivos de Dropbox');
    }
  }

  /**
   * Descarga un archivo de Dropbox
   */
  async downloadFile(filePath: string) {
    try {
      const response = await this.client.filesDownload({
        path: filePath,
      });

      return response.result;
    } catch (error) {
      console.error('Error downloading file from Dropbox:', error);
      throw new Error('Error al descargar archivo de Dropbox');
    }
  }

  /**
   * Sube un archivo a Dropbox
   */
  async uploadFile(fileBuffer: Buffer, fileName: string, folderPath: string = '') {
    try {
      const path = folderPath ? `/${folderPath}/${fileName}` : `/${fileName}`;

      const response = await this.client.filesUpload({
        path,
        contents: fileBuffer,
        mode: { '.tag': 'add' },
        autorename: true,
      });

      return {
        success: true,
        fileName: response.result.name,
        path: response.result.path_display,
        id: response.result.id,
      };
    } catch (error) {
      console.error('Error uploading file to Dropbox:', error);
      throw new Error('Error al subir archivo a Dropbox');
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
