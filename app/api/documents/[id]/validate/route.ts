import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { saveUserCorrections } from '@/lib/services/learning.service';
import { saveToSpecializedTable, detectSupplierInfo } from '@/lib/services/extractors/adaptive-extractor';
import { DocumentType } from '@prisma/client';

/**
 * POST /api/documents/[id]/validate
 *
 * Endpoint para validar y corregir datos extraídos
 *
 * El flujo es:
 * 1. Usuario revisa datos extraídos y hace correcciones
 * 2. Se guardan correcciones como feedback
 * 3. Se generan reglas de aprendizaje automáticamente
 * 4. Se actualiza el documento con datos corregidos
 * 5. Se guarda en tabla especializada
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID requerido' }, { status: 400 });
    }

    const documentId = params.id;
    const body = await request.json();
    const { correctedData, corrections, validationStatus } = body;

    // Validar que el documento existe y pertenece al tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Detectar información del proveedor desde los datos corregidos
    const supplierInfo = detectSupplierInfo(correctedData);

    // Guardar correcciones y generar reglas de aprendizaje
    let learningResult = null;
    if (corrections && corrections.length > 0 && document.documentType) {
      try {
        learningResult = await saveUserCorrections(
          documentId,
          userId,
          tenantId,
          document.documentType as DocumentType,
          corrections,
          supplierInfo.cuit
        );

        console.log(`[Validation] Generadas ${learningResult.learningRules.length} reglas de aprendizaje`);
      } catch (error) {
        console.error('[Validation] Error generando reglas de aprendizaje:', error);
        // No fallar la validación si falla el aprendizaje
      }
    }

    // Actualizar documento con datos corregidos
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedData: correctedData,
        validationStatus: validationStatus || 'APPROVED',
        validatedAt: new Date(),
        validatedBy: userId,
        // Actualizar información de clasificación si cambió
        ...(supplierInfo.cuit && {
          classification: {
            ...(document.classification as any),
            supplierCuit: supplierInfo.cuit,
            supplierName: supplierInfo.name,
          },
        }),
      },
    });

    // Guardar en tabla especializada
    if (document.documentType) {
      try {
        await saveToSpecializedTable(
          documentId,
          tenantId,
          document.documentType as DocumentType,
          correctedData,
          prisma
        );

        console.log(`[Validation] Datos guardados en tabla especializada para ${document.documentType}`);
      } catch (error) {
        console.error('[Validation] Error guardando en tabla especializada:', error);
        // No fallar la validación si falla el guardado en tabla especializada
      }
    }

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      learning: learningResult
        ? {
            rulesCreated: learningResult.learningRules.length,
            feedbackId: learningResult.feedback.id,
          }
        : null,
      message: 'Documento validado exitosamente',
    });
  } catch (error) {
    console.error('Error validating document:', error);
    return NextResponse.json(
      {
        error: 'Error al validar documento',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/[id]/validate
 *
 * Obtiene el estado de validación y feedback de un documento
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const documentId = params.id;

    // Obtener documento con feedbacks
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
      },
      include: {
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      documentId: document.id,
      validationStatus: document.validationStatus,
      validatedAt: document.validatedAt,
      validatedBy: document.validatedBy,
      feedbacks: document.feedbacks,
    });
  } catch (error) {
    console.error('Error getting validation status:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener estado de validación',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]/validate
 *
 * Actualiza el estado de validación sin hacer correcciones
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const documentId = params.id;
    const body = await request.json();
    const { validationStatus } = body;

    if (!validationStatus || !['APPROVED', 'REJECTED', 'PENDING', 'EDITED'].includes(validationStatus)) {
      return NextResponse.json(
        { error: 'Estado de validación inválido' },
        { status: 400 }
      );
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        validationStatus,
        validatedAt: new Date(),
        validatedBy: userId,
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error) {
    console.error('Error updating validation status:', error);
    return NextResponse.json(
      {
        error: 'Error al actualizar estado de validación',
      },
      { status: 500 }
    );
  }
}
