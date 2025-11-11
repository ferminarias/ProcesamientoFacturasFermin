'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar, ArrowRight } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface MonthlyData {
  month: string;
  displayMonth: string;
  total: number;
  byCategory: Record<string, number>;
}

interface ExpensesData {
  monthly: MonthlyData[];
  monthOverMonth: {
    current: number;
    previous: number;
    change: number;
    changePercent: string;
  } | null;
}

async function fetchExpensesAnalytics() {
  const res = await fetch('/api/analytics/expenses?months=6', {
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to fetch expenses');
  return res.json();
}

export function MonthComparisonWidget() {
  const { data, isLoading } = useQuery<ExpensesData>({
    queryKey: ['expenses-analytics'],
    queryFn: fetchExpensesAnalytics,
    refetchInterval: 300000, // Refetch cada 5 minutos
  });

  if (isLoading) {
    return (
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">📊 Comparación Mensual</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-40 sm:h-48 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (!data || data.monthly.length === 0) {
    return (
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Comparación Mensual
        </h3>
        <div className="text-center py-6 sm:py-8 text-muted-foreground">
          <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm sm:text-base">No hay suficientes datos para comparar</p>
        </div>
      </Card>
    );
  }

  const { monthly, monthOverMonth } = data;

  // Calcular tendencias por categoría
  const categories = ['Facturas', 'Servicios', 'Impuestos', 'Tarjetas'];
  const monthlyWithCategories = monthly.map((month) => ({
    ...month,
    Facturas: month.byCategory['Facturas'] || 0,
    Servicios: month.byCategory['Servicios'] || 0,
    Impuestos: month.byCategory['Impuestos'] || 0,
    Tarjetas: month.byCategory['Tarjetas'] || 0,
  }));

  // Calcular cambios por categoría (último mes vs penúltimo)
  const currentMonth = monthly[monthly.length - 1];
  const previousMonth = monthly[monthly.length - 2];

  const categoryChanges = categories
    .map((category) => {
      const current = currentMonth?.byCategory[category] || 0;
      const previous = previousMonth?.byCategory[category] || 0;
      const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

      return {
        category,
        current,
        previous,
        change,
        direction: change >= 0 ? 'up' : 'down',
      };
    })
    .filter((item) => item.current > 0 || item.previous > 0);

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Comparación Mensual
        </h3>
        {monthOverMonth && (
          <Badge variant={monthOverMonth.change >= 0 ? 'destructive' : 'default'} className="self-start sm:self-auto text-xs sm:text-sm">
            {monthOverMonth.change >= 0 ? '+' : ''}
            {monthOverMonth.changePercent}% MoM
          </Badge>
        )}
      </div>

      {/* Comparación mes a mes destacada */}
      {monthOverMonth && previousMonth && currentMonth && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex-1">
              <div className="text-xs sm:text-sm text-muted-foreground">{previousMonth.displayMonth}</div>
              <div className="text-lg sm:text-2xl font-bold">
                ${monthOverMonth.previous.toLocaleString('es-AR')}
              </div>
            </div>
            <ArrowRight
              className={`h-5 w-5 sm:h-8 sm:w-8 mx-2 sm:mx-4 shrink-0 ${
                monthOverMonth.change >= 0 ? 'text-red-500' : 'text-green-500'
              }`}
            />
            <div className="flex-1 text-right">
              <div className="text-xs sm:text-sm text-muted-foreground">{currentMonth.displayMonth}</div>
              <div className="text-lg sm:text-2xl font-bold">
                ${monthOverMonth.current.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            {monthOverMonth.change >= 0 ? (
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            )}
            <span
              className={`text-sm sm:text-lg font-bold ${
                monthOverMonth.change >= 0 ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {monthOverMonth.change >= 0 ? 'Aumento' : 'Reducción'} del{' '}
              {Math.abs(parseFloat(monthOverMonth.changePercent))}%
            </span>
          </div>
        </div>
      )}

      {/* Gráfico de línea por categoría */}
      <div className="mb-4 sm:mb-6">
        <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Tendencia por Categoría</h4>
        <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
          <LineChart data={monthlyWithCategories}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayMonth" tick={{ fontSize: 10 }} className="sm:text-sm" />
            <YAxis tick={{ fontSize: 10 }} className="sm:text-sm" />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
              labelStyle={{ color: '#000' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="Facturas" stroke="#8b5cf6" strokeWidth={2} />
            <Line type="monotone" dataKey="Servicios" stroke="#3b82f6" strokeWidth={2} />
            <Line type="monotone" dataKey="Impuestos" stroke="#ef4444" strokeWidth={2} />
            <Line type="monotone" dataKey="Tarjetas" stroke="#f59e0b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de área total */}
      <div className="mb-4 sm:mb-6">
        <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Gasto Total Mensual</h4>
        <ResponsiveContainer width="100%" height={150} className="sm:h-[200px]">
          <AreaChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayMonth" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
              labelStyle={{ color: '#000' }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cambios por categoría */}
      {categoryChanges.length > 0 && (
        <div>
          <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Cambios por Categoría (MoM)</h4>
          <div className="space-y-2">
            {categoryChanges.map((item) => (
              <div
                key={item.category}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 rounded-lg border bg-card gap-2 sm:gap-0"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`p-0.5 sm:p-1 rounded ${
                      item.direction === 'up' ? 'bg-red-100' : 'bg-green-100'
                    }`}
                  >
                    {item.direction === 'up' ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-xs sm:text-sm">{item.category}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      ${item.previous.toLocaleString('es-AR')} → $
                      {item.current.toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={item.direction === 'up' ? 'destructive' : 'default'}
                  className="font-mono text-xs self-start sm:self-auto"
                >
                  {item.change >= 0 ? '+' : ''}
                  {item.change.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
