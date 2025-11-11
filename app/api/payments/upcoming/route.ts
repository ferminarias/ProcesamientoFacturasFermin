import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { addDays, isPast, isToday, parseISO } from 'date-fns';

/**
 * GET /api/payments/upcoming
 *
 * Obtiene los próximos vencimientos de pagos basándose en documentos procesados
 * Soporta: Servicios, Impuestos, Tarjetas de Crédito
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID requerido' },
        { status: 400 }
      );
    }

    // Obtener parámetro de días (default: 30)
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    // Calcular rango de fechas
    const today = new Date();
    const futureDate = addDays(today, days);

    // Obtener documentos con fecha de vencimiento
    const documents = await prisma.document.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        classification: {
          path: ['type'],
          in: [
            'SERVICIO_LUZ',
            'SERVICIO_GAS',
            'SERVICIO_AGUA',
            'SERVICIO_INTERNET',
            'SERVICIO_TELEFONO',
            'SERVICIO_CABLE',
            'IMPUESTO_ARBA',
            'IMPUESTO_ABL',
            'IMPUESTO_PATENTE',
            'IMPUESTO_IIBB',
            'IMPUESTO_MONOTRIBUTO',
            'IMPUESTO_GANANCIAS',
            'TARJETA_CREDITO',
          ],
        },
      },
      select: {
        id: true,
        fileName: true,
        classification: true,
        extractedData: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Extraer información de pagos
    const payments = documents
      .map((doc) => {
        const data = doc.extractedData as any;
        const classification = doc.classification as any;

        // Extraer fecha de vencimiento según el tipo
        let dueDate: string | null = null;
        let amount: number = 0;
        let company: string | undefined;

        if (classification?.type?.startsWith('SERVICIO_')) {
          dueDate = data?.fechaVencimiento || data?.fecha_vencimiento;
          amount = parseFloat(data?.importeTotal || data?.importe_total || data?.total || 0);
          company = data?.empresa || data?.proveedor;
        } else if (classification?.type?.startsWith('IMPUESTO_')) {
          dueDate = data?.vencimiento || data?.fechaVencimiento || data?.fecha_vencimiento;
          amount = parseFloat(data?.importe || data?.total || 0);
          company = data?.organismo || data?.entidad;
        } else if (classification?.type === 'TARJETA_CREDITO') {
          dueDate = data?.vencimiento || data?.fechaVencimiento || data?.fecha_vencimiento;
          amount = parseFloat(data?.pagoMinimo || data?.pago_minimo || data?.total || 0);
          company = data?.banco || data?.emisor;
        }

        if (!dueDate) return null;

        try {
          // Intentar parsear diferentes formatos de fecha
          const parsedDate = parseISO(dueDate);

          // Determinar estado del pago
          let status: 'pending' | 'paid' | 'overdue' = 'pending';
          if (isPast(parsedDate) && !isToday(parsedDate)) {
            status = 'overdue';
          }

          return {
            id: doc.id,
            documentId: doc.id,
            fileName: doc.fileName,
            type: classification?.type || 'UNKNOWN',
            dueDate: parsedDate.toISOString(),
            amount,
            status,
            company,
          };
        } catch (error) {
          console.error(`Error parsing date for document ${doc.id}:`, dueDate);
          return null;
        }
      })
      .filter((payment) => payment !== null);

    // Filtrar por rango de fechas (solo futuros y vencidos recientes)
    const filteredPayments = payments.filter((payment) => {
      if (!payment) return false;
      const paymentDate = new Date(payment.dueDate);

      // Incluir:
      // 1. Pagos vencidos (hasta 90 días atrás)
      // 2. Pagos de hoy
      // 3. Pagos futuros (hasta N días adelante)
      const ninetyDaysAgo = addDays(today, -90);
      return paymentDate >= ninetyDaysAgo && paymentDate <= futureDate;
    });

    // Ordenar por fecha de vencimiento (más próximos primero)
    const sortedPayments = filteredPayments.sort((a, b) => {
      if (!a || !b) return 0;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Calcular estadísticas
    const stats = {
      total: sortedPayments.length,
      overdue: sortedPayments.filter((p) => p?.status === 'overdue').length,
      today: sortedPayments.filter((p) => p && isToday(new Date(p.dueDate))).length,
      upcoming: sortedPayments.filter(
        (p) => p && !isPast(new Date(p.dueDate)) && !isToday(new Date(p.dueDate))
      ).length,
      totalAmount: sortedPayments.reduce((sum, p) => sum + (p?.amount || 0), 0),
    };

    return NextResponse.json({
      payments: sortedPayments,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching upcoming payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos próximos' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payments/upcoming/:documentId
 *
 * Marca un pago como pagado
 */
export async function PATCH(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID requerido' },
        { status: 400 }
      );
    }

    const { documentId, status } = await request.json();

    if (!documentId || !status) {
      return NextResponse.json(
        { error: 'Document ID y status requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el documento existe y pertenece al tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar metadata del documento para marcar como pagado
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedData: {
          ...(document.extractedData as any),
          paymentStatus: status,
          paymentDate: status === 'paid' ? new Date().toISOString() : null,
        },
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return NextResponse.json(
      { error: 'Error al actualizar estado de pago' },
      { status: 500 }
    );
  }
}
