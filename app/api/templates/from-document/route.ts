import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { analyzeDocumentAndSuggestFields, analyzeDocumentWithVision } from '@/lib/services/template-builder.service';
import { createTemplate } from '@/lib/services/template.service';
import { processOCR } from '@/lib/services/ocr.service';

/**
 * POST /api/templates/from-document
 *
 * Crea un template automáticamente desde un documento
 *
 * FLUJO:
 * 1. Usuario sube documento
 * 2. Sistema hace OCR
 * 3. IA analiza y sugiere campos
 * 4. Usuario puede editar la sugerencia
 * 5. Se crea el template
 *
 * Body:
 * - documentId: ID del documento
 * - name?: Nombre custom (si no se especifica, usa el sugerido)
 * - selectedFields?: Array de nombres de campos a incluir (si no se especifica, todos)
 * - customEdits?: Ediciones manuales a los campos sugeridos
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Tenant ID y User ID requeridos' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { documentId, name, selectedFields, customEdits, useVision } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId requerido' }, { status: 400 });
    }

    // Obtener documento
    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: { ocrResult: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Hacer OCR si no existe
    let ocrText = document.ocrResult?.rawText;
    if (!ocrText && document.fileUrl) {
      console.log('[FromDocument] Haciendo OCR del documento...');
      const ocrResult = await processOCR(document.fileUrl, document.mimeType);
      ocrText = ocrResult.rawText;

      // Guardar OCR result
      await prisma.oCRResult.create({
        data: {
          documentId: document.id,
          tenantId,
          provider: ocrResult.provider,
          rawText: ocrResult.rawText,
          confidence: ocrResult.confidence,
          language: ocrResult.language,
          pageCount: ocrResult.pageCount,
          hasHandwriting: ocrResult.hasHandwriting,
          imageQuality: ocrResult.imageQuality,
          processingTime: ocrResult.processingTime,
          costEstimate: ocrResult.costEstimate,
        },
      });
    }

    if (!ocrText) {
      return NextResponse.json(
        { error: 'No se pudo extraer texto del documento' },
        { status: 400 }
      );
    }

    // Analizar documento y sugerir campos
    console.log('[FromDocument] Analizando documento con IA...');
    let suggestion;

    if (useVision && document.fileUrl) {
      suggestion = await analyzeDocumentWithVision(document.fileUrl);
    } else {
      suggestion = await analyzeDocumentAndSuggestFields(ocrText, document.fileUrl);
    }

    // Filtrar campos seleccionados
    let fields = suggestion.fields;
    if (selectedFields && Array.isArray(selectedFields)) {
      fields = fields.filter((f) => selectedFields.includes(f.name));
    }

    // Aplicar ediciones custom
    if (customEdits) {
      fields = fields.map((field) => {
        const edit = customEdits[field.name];
        return edit ? { ...field, ...edit } : field;
      });
    }

    // Crear template
    console.log('[FromDocument] Creando template...');
    const template = await createTemplate({
      tenantId,
      userId,
      name: name || suggestion.suggestedName,
      description: suggestion.suggestedDescription,
      documentType: mapDetectedTypeToDocumentType(suggestion.detectedType),
      customPrompt: suggestion.customPrompt,
      fields: fields.map((field) => ({
        name: field.name,
        label: field.label,
        description: field.description,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        isArray: false,
        options: field.options,
        validation: field.validation,
        extractionHint: field.extractionHint,
        group: field.group,
      })),
      autoDetect: true,
      detectionRules: suggestion.detectionRules,
      validationRules: suggestion.validationRules,
      requiredFields: fields.filter((f) => f.isRequired).map((f) => f.name),
      askIfMissing: true,
      allowConversation: true,
    });

    // Vincular template al documento
    await prisma.document.update({
      where: { id: documentId },
      data: { templateId: template.id },
    });

    return NextResponse.json({
      success: true,
      template,
      suggestion, // Devolver también la sugerencia original
      message: 'Template creado exitosamente desde el documento',
    });
  } catch (error) {
    console.error('Error creando template desde documento:', error);
    return NextResponse.json(
      {
        error: 'Error al crear template',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * Mapea el tipo detectado al enum DocumentType de Prisma
 */
function mapDetectedTypeToDocumentType(detectedType: string): any {
  const mapping: Record<string, string> = {
    FACTURA: 'FACTURA_B',
    TICKET: 'OTRO',
    SERVICIO: 'SERVICIO_LUZ',
    RESUMEN_TARJETA: 'RESUMEN_TARJETA',
    IMPUESTO: 'IMPUESTO_ARBA',
    OTRO: 'OTRO',
  };

  return mapping[detectedType.toUpperCase()] || null;
}
