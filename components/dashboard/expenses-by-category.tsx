'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ExpensesData {
  summary: {
    total: number;
    count: number;
    average: number;
    formatted: string;
  };
  byCategory: Array<{
    name: string;
    value: number;
    formatted: string;
  }>;
  bySubcategory: Array<{
    name: string;
    category: string;
    amount: number;
    count: number;
    average: number;
    formatted: string;
  }>;
  monthly: Array<{
    month: string;
    displayMonth: string;
    total: number;
    byCategory: Record<string, number>;
  }>;
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

const COLORS = {
  Facturas: '#8b5cf6',
  Servicios: '#3b82f6',
  Impuestos: '#ef4444',
  Tarjetas: '#f59e0b',
  Otros: '#6b7280',
};

export function ExpensesByCategoryWidget() {
  const { data, isLoading } = useQuery<ExpensesData>({
    queryKey: ['expenses-analytics'],
    queryFn: fetchExpensesAnalytics,
    refetchInterval: 300000, // Refetch cada 5 minutos
  });

  if (isLoading) {
    return (
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">💰 Análisis de Gastos</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-48 sm:h-64 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (!data || data.byCategory.length === 0) {
    return (
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
          Análisis de Gastos
        </h3>
        <div className="text-center py-6 sm:py-8 text-muted-foreground">
          <PieChart className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm sm:text-base">No hay datos de gastos disponibles</p>
          <p className="text-xs sm:text-sm mt-1">Procesa documentos para ver el análisis</p>
        </div>
      </Card>
    );
  }

  const { summary, byCategory, bySubcategory, monthOverMonth } = data;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
          Análisis de Gastos
        </h3>
        <div className="text-left sm:text-right">
          <div className="text-xl sm:text-2xl font-bold">{summary.formatted}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{summary.count} documentos</div>
        </div>
      </div>

      {/* Comparación mes a mes */}
      {monthOverMonth && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium">Mes actual vs anterior</span>
            <div className="flex items-center gap-2">
              {monthOverMonth.change >= 0 ? (
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
              )}
              <span
                className={`text-xs sm:text-sm font-bold ${
                  monthOverMonth.change >= 0 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {monthOverMonth.change >= 0 ? '+' : ''}
                {monthOverMonth.changePercent}%
              </span>
            </div>
          </div>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-xs text-muted-foreground">
            <span>Anterior: ${monthOverMonth.previous.toLocaleString('es-AR')}</span>
            <span>Actual: ${monthOverMonth.current.toLocaleString('es-AR')}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="category" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="category" className="text-xs sm:text-sm">Por Categoría</TabsTrigger>
          <TabsTrigger value="subcategory" className="text-xs sm:text-sm">Detallado</TabsTrigger>
          <TabsTrigger value="pie" className="text-xs sm:text-sm">Distribución</TabsTrigger>
        </TabsList>

        {/* Gráfico por categoría */}
        <TabsContent value="category" className="space-y-3 sm:space-y-4">
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
                labelStyle={{ color: '#000' }}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]}>
                {byCategory.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.Otros}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {byCategory.map((category) => (
              <div
                key={category.name}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        COLORS[category.name as keyof typeof COLORS] || COLORS.Otros,
                    }}
                  />
                  <span className="font-medium text-xs sm:text-sm truncate">{category.name}</span>
                </div>
                <span className="text-xs sm:text-sm font-bold ml-2">{category.formatted}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Gráfico detallado por subcategoría */}
        <TabsContent value="subcategory" className="space-y-3 sm:space-y-4">
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <BarChart data={bySubcategory.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
                labelStyle={{ color: '#000' }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            {bySubcategory.slice(0, 8).map((sub) => (
              <div
                key={sub.name}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 rounded-lg border bg-card gap-2 sm:gap-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-xs sm:text-sm">{sub.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {sub.category}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {sub.count} doc{sub.count !== 1 ? 's' : ''} • Prom: $
                    {sub.average.toLocaleString('es-AR')}
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-bold">{sub.formatted}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Gráfico de torta */}
        <TabsContent value="pie" className="space-y-3 sm:space-y-4">
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <RePieChart>
              <Pie
                data={byCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {byCategory.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.Otros}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
                labelStyle={{ color: '#000' }}
              />
            </RePieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {byCategory.map((category) => {
              const percentage = ((category.value / summary.total) * 100).toFixed(1);
              return (
                <div key={category.name} className="p-2 sm:p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <div
                      className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          COLORS[category.name as keyof typeof COLORS] || COLORS.Otros,
                      }}
                    />
                    <span className="font-medium text-xs sm:text-sm">{category.name}</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold">{category.formatted}</div>
                  <div className="text-xs text-muted-foreground">{percentage}% del total</div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
