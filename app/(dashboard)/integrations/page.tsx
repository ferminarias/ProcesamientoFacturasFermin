'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, Trash2, Download } from 'lucide-react';

async function fetchIntegrations() {
  const res = await fetch('/api/integrations', {
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to fetch integrations');
  return res.json();
}

async function deleteIntegration(id: string) {
  const res = await fetch(`/api/integrations?id=${id}`, {
    method: 'DELETE',
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to delete integration');
  return res.json();
}

async function getGoogleAuthUrl() {
  const res = await fetch('/api/integrations/google/auth');
  if (!res.ok) throw new Error('Failed to get auth URL');
  const data = await res.json();
  return data.authUrl;
}

async function saveGoogleIntegration(accessToken: string, refreshToken: string) {
  const res = await fetch('/api/integrations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify({
      provider: 'GOOGLE_SHEETS',
      accessToken,
      refreshToken,
    }),
  });
  if (!res.ok) throw new Error('Failed to save integration');
  return res.json();
}

async function exportToSheets(spreadsheetId: string) {
  const res = await fetch('/api/exports/sheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify({ spreadsheetId }),
  });
  if (!res.ok) throw new Error('Failed to export');
  return res.json();
}

async function exportToExcel() {
  const res = await fetch('/api/exports/excel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to export');
  return res.blob();
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: 'Integración eliminada',
        description: 'La integración se ha eliminado correctamente',
      });
    },
  });

  const saveGoogleMutation = useMutation({
    mutationFn: ({ accessToken, refreshToken }: any) =>
      saveGoogleIntegration(accessToken, refreshToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: 'Integración configurada',
        description: 'Google Sheets se ha conectado correctamente',
      });
    },
  });

  const exportSheetsMutation = useMutation({
    mutationFn: exportToSheets,
    onSuccess: (data) => {
      toast({
        title: 'Exportación completada',
        description: `${data.documentCount} documentos exportados`,
      });
    },
  });

  const exportExcelMutation = useMutation({
    mutationFn: exportToExcel,
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Descarga iniciada',
        description: 'El archivo Excel se está descargando',
      });
    },
  });

  // Handle OAuth callback
  useEffect(() => {
    const googleAuth = searchParams.get('google_auth');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (googleAuth === 'success' && accessToken && refreshToken) {
      saveGoogleMutation.mutate({ accessToken, refreshToken });
      // Clean URL
      window.history.replaceState({}, '', '/integrations');
    } else if (googleAuth === 'error') {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con Google',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/integrations');
    }
  }, [searchParams]);

  const integrations = data?.integrations || [];
  const googleIntegration = integrations.find(
    (i: any) => i.provider === 'GOOGLE_SHEETS' && i.isActive
  );

  const handleConnectGoogle = async () => {
    try {
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo iniciar la conexión con Google',
        variant: 'destructive',
      });
    }
  };

  const handleExportToSheets = () => {
    const spreadsheetId = prompt('Ingresa el ID de tu Google Spreadsheet:');
    if (spreadsheetId) {
      exportSheetsMutation.mutate(spreadsheetId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integraciones</h1>
        <p className="text-muted-foreground">
          Conecta con servicios externos para exportar datos
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Sheets */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">Google Sheets</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Exporta documentos directamente a Google Sheets
              </p>
            </div>
            {googleIntegration ? (
              <Badge variant="success">
                <CheckCircle className="mr-1 h-3 w-3" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="mr-1 h-3 w-3" />
                Desconectado
              </Badge>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {googleIntegration ? (
              <>
                <Button
                  onClick={handleExportToSheets}
                  disabled={exportSheetsMutation.isPending}
                  className="w-full"
                >
                  {exportSheetsMutation.isPending
                    ? 'Exportando...'
                    : 'Exportar a Sheets'}
                </Button>
                <Button
                  onClick={() => deleteMutation.mutate(googleIntegration.id)}
                  variant="outline"
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button onClick={handleConnectGoogle} className="w-full">
                Conectar con Google
              </Button>
            )}
          </div>
        </Card>

        {/* Excel Export */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">Microsoft Excel</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Descarga tus documentos en formato Excel
              </p>
            </div>
            <Badge variant="success">
              <CheckCircle className="mr-1 h-3 w-3" />
              Disponible
            </Badge>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => exportExcelMutation.mutate()}
              disabled={exportExcelMutation.isPending}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {exportExcelMutation.isPending
                ? 'Generando...'
                : 'Descargar Excel'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Export History */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Historial de Exportaciones</h3>
        <p className="text-sm text-muted-foreground">
          Próximamente: Ver historial de todas tus exportaciones
        </p>
      </Card>
    </div>
  );
}
