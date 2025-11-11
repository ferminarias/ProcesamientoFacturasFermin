import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * GET /api/analytics/expenses
 *
 * Analiza gastos por categoría y mes
 * Extrae montos de documentos procesados y los agrupa
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '6'); // Últimos 6 meses por defecto

    // Obtener documentos completados con datos extraídos
    const documents = await prisma.document.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        classification: { not: null },
        extractedData: { not: null },
      },
      select: {
        id: true,
        fileName: true,
        classification: true,
        extractedData: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mapear tipos a categorías legibles
    const categoryMapping: Record<string, string> = {
      FACTURA_A: 'Facturas',
      FACTURA_B: 'Facturas',
      FACTURA_C: 'Facturas',
      FACTURA_E: 'Facturas',
      FACTURA_M: 'Facturas',
      SERVICIO_LUZ: 'Servicios',
      SERVICIO_GAS: 'Servicios',
      SERVICIO_AGUA: 'Servicios',
      SERVICIO_INTERNET: 'Servicios',
      SERVICIO_TELEFONO: 'Servicios',
      SERVICIO_CABLE: 'Servicios',
      IMPUESTO_ARBA: 'Impuestos',
      IMPUESTO_ABL: 'Impuestos',
      IMPUESTO_PATENTE: 'Impuestos',
      IMPUESTO_IIBB: 'Impuestos',
      IMPUESTO_MONOTRIBUTO: 'Impuestos',
      IMPUESTO_GANANCIAS: 'Impuestos',
      TARJETA_CREDITO: 'Tarjetas',
    };

    // Subcategorías (tipos específicos)
    const subcategoryMapping: Record<string, string> = {
      FACTURA_A: 'Factura A',
      FACTURA_B: 'Factura B',
      FACTURA_C: 'Factura C',
      FACTURA_E: 'Factura E',
      FACTURA_M: 'Factura M',
      SERVICIO_LUZ: 'Luz',
      SERVICIO_GAS: 'Gas',
      SERVICIO_AGUA: 'Agua',
      SERVICIO_INTERNET: 'Internet',
      SERVICIO_TELEFONO: 'Teléfono',
      SERVICIO_CABLE: 'Cable',
      IMPUESTO_ARBA: 'ARBA',
      IMPUESTO_ABL: 'ABL',
      IMPUESTO_PATENTE: 'Patente',
      IMPUESTO_IIBB: 'IIBB',
      IMPUESTO_MONOTRIBUTO: 'Monotributo',
      IMPUESTO_GANANCIAS: 'Ganancias',
      TARJETA_CREDITO: 'Tarjeta de Crédito',
    };

    // Extraer gastos con montos
    const expenses = documents
      .map((doc) => {
        const data = doc.extractedData as any;
        const classification = doc.classification as any;
        const type = classification?.type;

        if (!type) return null;

        // Extraer monto según el tipo
        let amount = 0;
        if (type.startsWith('FACTURA_')) {
          amount = parseFloat(data?.total || data?.importeTotal || data?.importe_total || 0);
        } else if (type.startsWith('SERVICIO_')) {
          amount = parseFloat(data?.importeTotal || data?.importe_total || data?.total || 0);
        } else if (type.startsWith('IMPUESTO_')) {
          amount = parseFloat(data?.importe || data?.total || 0);
        } else if (type === 'TARJETA_CREDITO') {
          amount = parseFloat(data?.total || data?.saldoTotal || data?.saldo_total || 0);
        }

        const category = categoryMapping[type] || 'Otros';
        const subcategory = subcategoryMapping[type] || type;

        return {
          id: doc.id,
          fileName: doc.fileName,
          type,
          category,
          subcategory,
          amount,
          date: doc.createdAt,
        };
      })
      .filter((expense) => expense !== null && expense.amount > 0);

    // Gastos por categoría principal
    const byCategory = expenses.reduce((acc: Record<string, number>, expense) => {
      if (!expense) return acc;
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    const byCategoryArray = Object.entries(byCategory).map(([name, value]) => ({
      name,
      value,
      formatted: `$${value.toLocaleString('es-AR')}`,
    }));

    // Gastos por subcategoría (detallado)
    const bySubcategory = expenses.reduce(
      (acc: Record<string, { amount: number; count: number; category: string }>, expense) => {
        if (!expense) return acc;
        if (!acc[expense.subcategory]) {
          acc[expense.subcategory] = {
            amount: 0,
            count: 0,
            category: expense.category,
          };
        }
        acc[expense.subcategory].amount += expense.amount;
        acc[expense.subcategory].count += 1;
        return acc;
      },
      {}
    );

    const bySubcategoryArray = Object.entries(bySubcategory)
      .map(([name, data]) => ({
        name,
        category: data.category,
        amount: data.amount,
        count: data.count,
        average: data.amount / data.count,
        formatted: `$${data.amount.toLocaleString('es-AR')}`,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Tendencia mensual (últimos N meses)
    const monthlyData: Array<{
      month: string;
      displayMonth: string;
      total: number;
      byCategory: Record<string, number>;
    }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthExpenses = expenses.filter((expense) => {
        if (!expense) return false;
        const expenseDate = new Date(expense.date);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      });

      const monthTotal = monthExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);

      const monthByCategory = monthExpenses.reduce((acc: Record<string, number>, expense) => {
        if (!expense) return acc;
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {});

      monthlyData.push({
        month: format(monthDate, 'yyyy-MM'),
        displayMonth: format(monthDate, 'MMM yyyy', { locale: es }),
        total: monthTotal,
        byCategory: monthByCategory,
      });
    }

    // Calcular total y promedio
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);
    const averageExpense = totalExpenses / (expenses.length || 1);

    // Comparación mes actual vs mes anterior
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    const monthOverMonth = previousMonth
      ? {
          current: currentMonth?.total || 0,
          previous: previousMonth.total,
          change: ((currentMonth?.total || 0) - previousMonth.total) / previousMonth.total,
          changePercent: (
            (((currentMonth?.total || 0) - previousMonth.total) / previousMonth.total) *
            100
          ).toFixed(1),
        }
      : null;

    return NextResponse.json({
      summary: {
        total: totalExpenses,
        count: expenses.length,
        average: averageExpense,
        formatted: `$${totalExpenses.toLocaleString('es-AR')}`,
      },
      byCategory: byCategoryArray,
      bySubcategory: bySubcategoryArray,
      monthly: monthlyData,
      monthOverMonth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching expenses analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener análisis de gastos' },
      { status: 500 }
    );
  }
}
