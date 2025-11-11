import { NextRequest, NextResponse } from 'next/server';
import { validateTenant } from '@/lib/middleware/tenant.middleware';
import { prisma } from '@/lib/database/prisma.client';
import { ExcelExporter } from '@/lib/services/exporters/excel.exporter';

export async function POST(request: NextRequest) {
  try {
    const validation = await validateTenant(request);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const tenantId = validation.tenantId!;
    const body = await request.json();
    const { documentIds } = body;

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

    // Export to Excel
    const exporter = new ExcelExporter();
    const buffer = await exporter.exportDocuments(documents as any);

    // Log export
    await prisma.exportLog.create({
      data: {
        tenantId,
        format: 'EXCEL',
        documentCount: documents.length,
        status: 'COMPLETED',
        metadata: {
          documentIds,
        },
      },
    });

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="documents-export-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return NextResponse.json(
      { error: 'Failed to export to Excel' },
      { status: 500 }
    );
  }
}
