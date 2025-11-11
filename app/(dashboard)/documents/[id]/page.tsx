'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Check, X, Download } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

async function fetchDocument(id: string) {
  const res = await fetch(`/api/documents/${id}`, {
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to fetch document');
  return res.json();
}

async function validateDocument(id: string, data: any) {
  const res = await fetch(`/api/documents/${id}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'acme-corp',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to validate document');
  return res.json();
}

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id),
  });

  const form = useForm({
    values: document?.extractedData || {},
  });

  const validateMutation = useMutation({
    mutationFn: (data: any) => validateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: 'Documento validado',
        description: 'Los cambios se han guardado correctamente',
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo validar el documento',
        variant: 'destructive',
      });
    },
  });

  const onApprove = () => {
    validateMutation.mutate({
      status: 'APPROVED',
      extractedData: form.getValues(),
    });
  };

  const onReject = () => {
    validateMutation.mutate({
      status: 'REJECTED',
      extractedData: form.getValues(),
    });
  };

  const onSaveEdits = () => {
    validateMutation.mutate({
      status: 'EDITED',
      extractedData: form.getValues(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Cargando documento...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-muted-foreground">Documento no encontrado</p>
        <Link href="/documents">
          <Button className="mt-4">Volver a documentos</Button>
        </Link>
      </div>
    );
  }

  const renderField = (key: string, value: any, depth = 0) => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2" style={{ marginLeft: depth * 16 }}>
          <h4 className="font-semibold capitalize">{key.replace(/_/g, ' ')}</h4>
          {Object.entries(value).map(([k, v]) => renderField(k, v, depth + 1))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2" style={{ marginLeft: depth * 16 }}>
          <h4 className="font-semibold capitalize">{key.replace(/_/g, ' ')}</h4>
          {value.map((item, idx) => (
            <div key={idx} className="rounded-lg border p-3">
              {typeof item === 'object'
                ? Object.entries(item).map(([k, v]) => renderField(k, v, 0))
                : item}
            </div>
          ))}
        </div>
      );
    }

    return (
      <FormField
        key={key}
        control={form.control}
        name={key}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="capitalize">
              {key.replace(/_/g, ' ')}
            </FormLabel>
            <FormControl>
              {typeof value === 'string' && value.length > 100 ? (
                <Textarea
                  {...field}
                  disabled={!isEditing}
                  className="font-mono text-sm"
                />
              ) : (
                <Input
                  {...field}
                  disabled={!isEditing}
                  value={field.value || ''}
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/documents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{document.fileName}</h1>
            <p className="text-sm text-muted-foreground">
              {document.classification?.type || 'Tipo desconocido'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{document.status}</Badge>
          {document.validationStatus && (
            <Badge
              variant={
                document.validationStatus === 'APPROVED'
                  ? 'success'
                  : document.validationStatus === 'REJECTED'
                  ? 'destructive'
                  : 'warning'
              }
            >
              {document.validationStatus}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="data" className="w-full">
        <TabsList>
          <TabsTrigger value="data">Datos Extraídos</TabsTrigger>
          <TabsTrigger value="preview">Vista Previa</TabsTrigger>
          <TabsTrigger value="metadata">Metadatos</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Datos del Documento</h3>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={onSaveEdits}>Guardar Cambios</Button>
                </div>
              )}
            </div>

            <Form {...form}>
              <form className="space-y-4">
                {document.extractedData &&
                  Object.entries(document.extractedData).map(([key, value]) =>
                    renderField(key, value)
                  )}
              </form>
            </Form>

            <div className="mt-6 flex gap-2 border-t pt-6">
              <Button
                onClick={onApprove}
                disabled={validateMutation.isPending}
                className="flex-1"
              >
                <Check className="mr-2 h-4 w-4" />
                Aprobar
              </Button>
              <Button
                onClick={onReject}
                disabled={validateMutation.isPending}
                variant="destructive"
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" />
                Rechazar
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">
              Vista Previa del Documento
            </h3>
            {document.fileUrl ? (
              <div className="relative h-[800px] w-full overflow-auto rounded-lg border">
                <Image
                  src={document.fileUrl}
                  alt={document.fileName}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                No hay vista previa disponible
              </p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="metadata">
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Metadatos</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  ID
                </dt>
                <dd className="font-mono text-sm">{document.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Tipo MIME
                </dt>
                <dd className="text-sm">{document.mimeType}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Tamaño
                </dt>
                <dd className="text-sm">
                  {(document.fileSize / 1024).toFixed(2)} KB
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Subido el
                </dt>
                <dd className="text-sm">
                  {new Date(document.createdAt).toLocaleString()}
                </dd>
              </div>
              {document.classification && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Tipo Clasificado
                    </dt>
                    <dd className="text-sm">
                      {document.classification.type}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Confianza
                    </dt>
                    <dd className="text-sm">
                      {(document.classification.confidence * 100).toFixed(1)}%
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
