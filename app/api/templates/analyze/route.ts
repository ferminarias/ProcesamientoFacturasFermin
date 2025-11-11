import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocumentAndSuggestFields, analyzeDocumentWithVision } from '@/lib/services/template-builder.service';
import { processOCR } from '@/lib/services/ocr.service';
import { prisma } from '@/lib/db/prisma';

/**
 * POST /api/templates/analyze
 *
 * Analiza un documento y sugiere automáticamente qué campos extraer
 *
 * CASOS DE USO:
 * 1. Usuario sube documento sin template → Sistema sugiere campos
 * 2. Usuario quiere crear template → Le mostramos qué puede extraer
 * 3. Usuario quiere mejorar template existente → Sugerimos campos nuevos
 *
 * Body:
 * - documentId?: ID de documento ya procesado
 * - fileUrl?: URL de archivo a analizar
 * - useVision?: true para analizar con imagen, false para solo OCR text
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { documentId, fileUrl, useVision } = body;

    let ocrText: string | undefined;
    let imageUrl: string | undefined;

    // Caso 1: Analizar documento ya procesado
    if (documentId) {
      const document = await prisma.document.findFirst({
        where: { id: documentId, tenantId },
        include: { ocrResult: true },
      });

      if (!document) {
        return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      }

      ocrText = document.ocrResult?.rawText;
      imageUrl = document.fileUrl;

      if (!ocrText && !imageUrl) {
        return NextResponse.json(
          { error: 'Documento sin OCR procesado' },
          { status: 400 }
        );
      }
    }

    // Caso 2: Analizar archivo directo
    if (fileUrl) {
      imageUrl = fileUrl;

      // Hacer OCR primero si no se especifica useVision
      if (!useVision) {
        try {
          const ocrResult = await processOCR(fileUrl, 'image/jpeg');
          ocrText = ocrResult.rawText;
        } catch (error) {
          console.log('OCR falló, usando Vision directo');
        }
      }
    }

    if (!ocrText && !imageUrl) {
      return NextResponse.json(
        { error: 'Se requiere documentId o fileUrl' },
        { status: 400 }
      );
    }

    // Analizar y sugerir campos
    let suggestion;

    if (useVision && imageUrl) {
      // Análisis con Vision (más preciso pero más caro)
      suggestion = await analyzeDocumentWithVision(imageUrl);
    } else if (ocrText) {
      // Análisis con OCR text (más rápido y barato)
      suggestion = await analyzeDocumentAndSuggestFields(ocrText, imageUrl);
    } else {
      return NextResponse.json({ error: 'No hay datos para analizar' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      suggestion,
      message: 'Documento analizado exitosamente',
      fieldsCount: suggestion.fields.length,
      highConfidenceFields: suggestion.fields.filter((f) => f.confidence > 0.8).length,
    });
  } catch (error) {
    console.error('Error analizando documento:', error);
    return NextResponse.json(
      {
        error: 'Error al analizar documento',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
