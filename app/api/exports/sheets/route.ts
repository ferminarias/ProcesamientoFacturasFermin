import { NextRequest, NextResponse } from 'next/server';
import { validateTenant } from '@/lib/middleware/tenant.middleware';
import { prisma } from '@/lib/database/prisma.client';
import { GoogleSheetsExporter } from '@/lib/services/exporters/googleSheets.exporter';

export async function POST(request: NextRequest) {
  try {
    const validation = await validateTenant(request);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const tenantId = validation.tenantId!;
    const body = await request.json();
    const { documentIds, spreadsheetId } = body;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'spreadsheetId is required' },
        { status: 400 }
      );
    }

    // Get integration tokens
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId,
        provider: 'GOOGLE_SHEETS',
        isActive: true,
      },
    });

    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { error: 'Google Sheets integration not configured' },
        { status: 400 }
      );
    }

    // Fetch documents
    const documents = await prisma.document.findMany({
      where: {
        tenantId,
        id: documentIds ? { in: documentIds } : undefined,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents found' },
        { status: 404 }
      );
    }

    // Export to Google Sheets
    const exporter = new GoogleSheetsExporter({
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken || undefined,
    });

    await exporter.exportDocuments(documents as any, spreadsheetId);

    // Log export
    await prisma.exportLog.create({
      data: {
        tenantId,
        format: 'GOOGLE_SHEETS',
        documentCount: documents.length,
        status: 'COMPLETED',
        metadata: {
          spreadsheetId,
          documentIds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      documentCount: documents.length,
      spreadsheetId,
    });
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return NextResponse.json(
      { error: 'Failed to export to Google Sheets' },
      { status: 500 }
    );
  }
}
