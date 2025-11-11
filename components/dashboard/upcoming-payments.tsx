'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, AlertCircle, Clock, DollarSign, Check } from 'lucide-react';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

interface Payment {
  id: string;
  documentId: string;
  fileName: string;
  type: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  company?: string;
}

async function fetchUpcomingPayments(days: number = 30) {
  const res = await fetch(`/api/payments/upcoming?days=${days}`, {
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to fetch payments');
  return res.json();
}

async function markPaymentAsPaid(documentId: string) {
  const res = await fetch(`/api/payments/upcoming`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify({ documentId, status: 'paid' }),
  });
  if (!res.ok) throw new Error('Failed to mark payment as paid');
  return res.json();
}

export function UpcomingPaymentsWidget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-payments'],
    queryFn: () => fetchUpcomingPayments(30),
    refetchInterval: 60000, // Refetch cada minuto
  });

  const markAsPaidMutation = useMutation({
    mutationFn: markPaymentAsPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-payments'] });
      toast({
        title: 'Pago marcado como pagado',
        description: 'El pago ha sido registrado exitosamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo marcar el pago como pagado',
        variant: 'destructive',
      });
    },
  });

  const payments: Payment[] = data?.payments || [];

  // Clasificar pagos
  const overdue = payments.filter((p) => isPast(new Date(p.dueDate)) && p.status === 'pending');
  const today = payments.filter((p) => isToday(new Date(p.dueDate)) && p.status === 'pending');
  const upcoming = payments.filter(
    (p) => !isPast(new Date(p.dueDate)) && !isToday(new Date(p.dueDate)) && p.status === 'pending'
  );

  const getDaysUntil = (dueDate: string) => {
    return differenceInDays(new Date(dueDate), new Date());
  };

  const getUrgencyColor = (dueDate: string, status: string) => {
    if (status === 'paid') return 'default';
    if (isPast(new Date(dueDate))) return 'destructive';
    if (isToday(new Date(dueDate))) return 'warning';
    const days = getDaysUntil(dueDate);
    if (days <= 3) return 'warning';
    return 'default';
  };

  if (isLoading) {
    return (
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">📅 Próximos Vencimientos</h3>
        <div className="animate-pulse space-y-2 sm:space-y-3">
          <div className="h-12 sm:h-16 bg-muted rounded"></div>
          <div className="h-12 sm:h-16 bg-muted rounded"></div>
          <div className="h-12 sm:h-16 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Próximos Vencimientos
        </h3>
        {payments.length > 0 && (
          <Badge variant="outline" className="self-start sm:self-auto text-xs sm:text-sm">
            {payments.length} pago{payments.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-6 sm:py-8 text-muted-foreground">
          <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm sm:text-base">No hay pagos pendientes</p>
          <p className="text-xs sm:text-sm mt-1">¡Todo al día! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Vencidos */}
          {overdue.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Vencidos ({overdue.length})
              </h4>
              <div className="space-y-2">
                {overdue.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    urgency="overdue"
                    onMarkAsPaid={(id) => markAsPaidMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Hoy */}
          {today.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-yellow-600 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Vencen Hoy ({today.length})
              </h4>
              <div className="space-y-2">
                {today.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    urgency="today"
                    onMarkAsPaid={(id) => markAsPaidMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Próximos */}
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Próximos {upcoming.length > 5 ? '(mostrando 5)' : `(${upcoming.length})`}
              </h4>
              <div className="space-y-2">
                {upcoming.slice(0, 5).map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    urgency="upcoming"
                    onMarkAsPaid={(id) => markAsPaidMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 5 && (
            <Button variant="outline" className="w-full mt-2">
              Ver todos los pagos ({upcoming.length})
            </Button>
          )}
        </div>
      )}

      {/* Resumen total */}
      {payments.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total a pagar (30 días)</span>
            <span className="text-lg font-bold flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              ${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('es-AR')}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function PaymentCard({
  payment,
  urgency,
  onMarkAsPaid,
}: {
  payment: Payment;
  urgency: 'overdue' | 'today' | 'upcoming';
  onMarkAsPaid: (documentId: string) => void;
}) {
  const daysUntil = differenceInDays(new Date(payment.dueDate), new Date());

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border gap-2 sm:gap-0 ${
        urgency === 'overdue'
          ? 'bg-destructive/5 border-destructive'
          : urgency === 'today'
          ? 'bg-yellow-50 border-yellow-300'
          : 'bg-card'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{payment.company || payment.fileName}</p>
          <Badge variant="outline" className="text-xs shrink-0">
            {payment.type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(payment.dueDate), "d 'de' MMMM", { locale: es })}
          {urgency === 'overdue' && ` (${Math.abs(daysUntil)} días vencido)`}
          {urgency === 'today' && ' (¡Hoy!)'}
          {urgency === 'upcoming' && ` (en ${daysUntil} días)`}
        </p>
      </div>
      <div className="flex items-center justify-between sm:block sm:text-right">
        <p className="font-bold text-sm sm:text-base">${payment.amount.toLocaleString('es-AR')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-1 px-2 text-xs mt-0 sm:mt-1"
          onClick={() => onMarkAsPaid(payment.documentId)}
        >
          <Check className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Marcar pagado</span>
        </Button>
      </div>
    </div>
  );
}
