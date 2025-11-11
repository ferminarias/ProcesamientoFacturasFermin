import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { MicrosoftOneDriveExporter } from '@/lib/exporters/microsoft-onedrive.exporter';

/**
 * POST /api/exports/onedrive
 *
 * Exporta documentos a un archivo Excel en Microsoft OneDrive
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { fileName, folderName } = body;

    // Buscar integración de Microsoft
    const integration = await prisma.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'microsoft',
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integración con Microsoft no configurada' },
        { status: 404 }
      );
    }

    // Verificar si el token expiró
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Token de Microsoft expirado. Por favor reconecta la integración.' },
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
    const exporter = new MicrosoftOneDriveExporter({
      accessToken,
      refreshToken,
    });

    // Si se especifica una carpeta, crearla primero
    if (folderName) {
      await exporter.createFolder(folderName);
    }

    // Exportar a OneDrive
    const result = await exporter.exportToOneDrive(
      documents,
      fileName || `documentos_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    return NextResponse.json({
      success: true,
      ...result,
      totalDocuments: documents.length,
    });
  } catch (error) {
    console.error('Error exporting to OneDrive:', error);
    return NextResponse.json(
      { error: 'Error al exportar a OneDrive', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exports/onedrive
 *
 * Lista archivos y carpetas en OneDrive
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folderId = searchParams.get('folderId');

    // Buscar integración de Microsoft
    const integration = await prisma.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'microsoft',
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integración con Microsoft no configurada' },
        { status: 404 }
      );
    }

    // Desencriptar token
    const accessToken = decrypt(integration.accessToken);

    // Crear exporter
    const exporter = new MicrosoftOneDriveExporter({ accessToken });

    // Listar archivos
    const files = await exporter.listFiles(folderId || undefined);

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error listing OneDrive files:', error);
    return NextResponse.json(
      { error: 'Error al listar archivos de OneDrive' },
      { status: 500 }
    );
  }
}
