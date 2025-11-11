'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Power, PowerOff } from 'lucide-react';

async function fetchAutomations() {
  const res = await fetch('/api/automations', {
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to fetch automations');
  return res.json();
}

async function createAutomation(data: any) {
  const res = await fetch('/api/automations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create automation');
  return res.json();
}

async function toggleAutomation(id: string, enabled: boolean) {
  const res = await fetch(`/api/automations/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle automation');
  return res.json();
}

async function deleteAutomation(id: string) {
  const res = await fetch(`/api/automations/${id}`, {
    method: 'DELETE',
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to delete automation');
  return res.json();
}

export default function AutomationsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'DOCUMENT_PROCESSED',
    triggerDocumentType: '',
    actionType: 'EXPORT_SHEETS',
    actionSpreadsheetId: '',
    actionEmail: '',
    actionWebhookUrl: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: fetchAutomations,
  });

  const createMutation = useMutation({
    mutationFn: createAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      setIsDialogOpen(false);
      toast({
        title: 'Automatización creada',
        description: 'La automatización se ha creado correctamente',
      });
      setFormData({
        name: '',
        description: '',
        triggerType: 'DOCUMENT_PROCESSED',
        triggerDocumentType: '',
        actionType: 'EXPORT_SHEETS',
        actionSpreadsheetId: '',
        actionEmail: '',
        actionWebhookUrl: '',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleAutomation(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast({
        title: 'Automatización eliminada',
        description: 'La automatización se ha eliminado correctamente',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trigger: any = {
      type: formData.triggerType,
      config: {},
    };

    if (formData.triggerType === 'DOCUMENT_TYPE') {
      trigger.config.documentType = formData.triggerDocumentType;
    }

    const action: any = {
      type: formData.actionType,
      config: {},
    };

    if (formData.actionType === 'EXPORT_SHEETS') {
      action.config.spreadsheetId = formData.actionSpreadsheetId;
    } else if (formData.actionType === 'SEND_EMAIL') {
      action.config.email = formData.actionEmail;
    } else if (formData.actionType === 'WEBHOOK') {
      action.config.webhookUrl = formData.actionWebhookUrl;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      trigger,
      actions: [action],
    });
  };

  const automations = data?.automations || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automatizaciones</h1>
          <p className="text-muted-foreground">
            Automatiza tareas cuando se procesen documentos
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Automatización
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Cargando automatizaciones...</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <p className="text-muted-foreground">
              No hay automatizaciones configuradas
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
              Crear primera automatización
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Acciones</TableHead>
                <TableHead>Ejecuciones</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((automation: any) => (
                <TableRow key={automation.id}>
                  <TableCell className="font-medium">
                    <div>
                      <p>{automation.name}</p>
                      {automation.description && (
                        <p className="text-sm text-muted-foreground">
                          {automation.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {automation.trigger.type.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {automation.actions.map((action: any, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {action.type.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{automation._count.executions}</TableCell>
                  <TableCell>
                    {automation.enabled ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: automation.id,
                            enabled: !automation.enabled,
                          })
                        }
                      >
                        {automation.enabled ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(automation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Automatización</DialogTitle>
            <DialogDescription>
              Configura una automatización para ejecutar acciones cuando se
              cumplan ciertas condiciones
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="triggerType">Cuando</Label>
              <Select
                value={formData.triggerType}
                onValueChange={(value) =>
                  setFormData({ ...formData, triggerType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOCUMENT_PROCESSED">
                    Se procese cualquier documento
                  </SelectItem>
                  <SelectItem value="DOCUMENT_TYPE">
                    Se procese un tipo específico de documento
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.triggerType === 'DOCUMENT_TYPE' && (
              <div className="space-y-2">
                <Label htmlFor="documentType">Tipo de Documento</Label>
                <Select
                  value={formData.triggerDocumentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, triggerDocumentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FACTURA_A">Factura A</SelectItem>
                    <SelectItem value="FACTURA_B">Factura B</SelectItem>
                    <SelectItem value="FACTURA_C">Factura C</SelectItem>
                    <SelectItem value="SERVICIO_LUZ">Servicio de Luz</SelectItem>
                    <SelectItem value="TARJETA_CREDITO">
                      Tarjeta de Crédito
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="actionType">Acción</Label>
              <Select
                value={formData.actionType}
                onValueChange={(value) =>
                  setFormData({ ...formData, actionType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPORT_SHEETS">
                    Exportar a Google Sheets
                  </SelectItem>
                  <SelectItem value="EXPORT_EXCEL">
                    Generar archivo Excel
                  </SelectItem>
                  <SelectItem value="SEND_EMAIL">Enviar email</SelectItem>
                  <SelectItem value="WEBHOOK">Llamar webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.actionType === 'EXPORT_SHEETS' && (
              <div className="space-y-2">
                <Label htmlFor="spreadsheetId">ID de Spreadsheet</Label>
                <Input
                  id="spreadsheetId"
                  value={formData.actionSpreadsheetId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      actionSpreadsheetId: e.target.value,
                    })
                  }
                  placeholder="1AbC..."
                  required
                />
              </div>
            )}

            {formData.actionType === 'SEND_EMAIL' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.actionEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, actionEmail: e.target.value })
                  }
                  required
                />
              </div>
            )}

            {formData.actionType === 'WEBHOOK' && (
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">URL del Webhook</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={formData.actionWebhookUrl}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      actionWebhookUrl: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creando...' : 'Crear Automatización'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
