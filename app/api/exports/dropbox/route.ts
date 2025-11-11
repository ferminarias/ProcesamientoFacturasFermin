import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { DropboxExporter } from '@/lib/exporters/dropbox.exporter';

/**
 * POST /api/exports/dropbox
 *
 * Exporta documentos a un archivo Excel en Dropbox
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { fileName, folderPath } = body;

    // Buscar integración de Dropbox
    const integration = await prisma.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'dropbox',
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integración con Dropbox no configurada' },
        { status: 404 }
      );
    }

    // Verificar si el token expiró
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Token de Dropbox expirado. Por favor reconecta la integración.' },
        { status: 401 }
      );
    }

    // Desencriptar tokens
    const accessToken = decrypt(integration.accessToken);
    const refreshToken = integration.refreshToken ? decrypt(integration.refreshToken) : undefined;

    // Obtener documentos completados
    const documents = await prisma.document.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'No hay documentos para exportar' },
        { status: 400 }
      );
    }

    // Crear exporter
    const exporter = new DropboxExporter({
      accessToken,
      refreshToken,
    });

    // Si se especifica una carpeta, crearla primero
    if (folderPath) {
      await exporter.createFolder(folderPath);
    }

    // Exportar a Dropbox
    const result = await exporter.exportToDropbox(
      documents,
      fileName || `documentos_${new Date().toISOString().split('T')[0]}.xlsx`,
      folderPath
    );

    return NextResponse.json({
      success: true,
      ...result,
      totalDocuments: documents.length,
    });
  } catch (error) {
    console.error('Error exporting to Dropbox:', error);
    return NextResponse.json(
      { error: 'Error al exportar a Dropbox', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exports/dropbox
 *
 * Lista archivos y carpetas en Dropbox
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folderPath = searchParams.get('folderPath') || '';

    // Buscar integración de Dropbox
    const integration = await prisma.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'dropbox',
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integración con Dropbox no configurada' },
        { status: 404 }
      );
    }

    // Desencriptar token
    const accessToken = decrypt(integration.accessToken);

    // Crear exporter
    const exporter = new DropboxExporter({ accessToken });

    // Listar archivos
    const files = await exporter.listFiles(folderPath);

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error listing Dropbox files:', error);
    return NextResponse.json(
      { error: 'Error al listar archivos de Dropbox' },
      { status: 500 }
    );
  }
}
