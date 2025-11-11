import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createTemplate, listTemplates } from '@/lib/services/template.service';
import { FieldType } from '@prisma/client';

/**
 * POST /api/templates
 * Crear nuevo template
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
    const {
      name,
      description,
      documentType,
      customPrompt,
      systemPrompt,
      fields,
      autoDetect,
      detectionRules,
      validationRules,
      requiredFields,
      askIfMissing,
      allowConversation,
    } = body;

    if (!name || !customPrompt || !fields || fields.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: name, customPrompt, fields' },
        { status: 400 }
      );
    }

    // Crear template
    const template = await createTemplate({
      tenantId,
      userId,
      name,
      description,
      documentType,
      customPrompt,
      systemPrompt,
      fields: fields.map((field: any) => ({
        ...field,
        fieldType: field.fieldType as FieldType,
      })),
      autoDetect,
      detectionRules,
      validationRules,
      requiredFields,
      askIfMissing,
      allowConversation,
    });

    return NextResponse.json({
      success: true,
      template,
      message: 'Template creado exitosamente',
    });
  } catch (error) {
    console.error('Error creando template:', error);
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
 * GET /api/templates
 * Listar todos los templates del tenant
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    // Parámetros de query
    const { searchParams } = new URL(request.url);
    const onlyMine = searchParams.get('onlyMine') === 'true';

    const templates = await listTemplates(tenantId, onlyMine ? userId || undefined : undefined);

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error listando templates:', error);
    return NextResponse.json(
      {
        error: 'Error al listar templates',
      },
      { status: 500 }
    );
  }
}
