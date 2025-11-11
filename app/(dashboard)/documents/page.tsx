'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, any> = {
  COMPLETED: 'success',
  VALIDATING: 'warning',
  PROCESSING: 'default',
  FAILED: 'destructive',
  QUEUED: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completado',
  VALIDATING: 'En Validación',
  PROCESSING: 'Procesando',
  FAILED: 'Fallido',
  QUEUED: 'En Cola',
  CLASSIFYING: 'Clasificando',
  EXTRACTING: 'Extrayendo',
};

async function fetchDocuments(filters: any) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.type) params.append('type', filters.type);
  if (filters.status) params.append('status', filters.status);

  const res = await fetch(`/api/documents?${params.toString()}`, {
    headers: { 'x-tenant-id': 'acme-corp' },
  });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { search, type, status }],
    queryFn: () => fetchDocuments({ search, type, status }),
  });

  const documents = data?.documents || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documentos</h1>
          <p className="text-muted-foreground">
            Gestiona tus documentos procesados
          </p>
        </div>
        <Link href="/upload">
          <Button>Subir Documentos</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre de archivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de documento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="FACTURA_A">Factura A</SelectItem>
              <SelectItem value="FACTURA_B">Factura B</SelectItem>
              <SelectItem value="FACTURA_C">Factura C</SelectItem>
              <SelectItem value="SERVICIO_LUZ">Luz</SelectItem>
              <SelectItem value="SERVICIO_GAS">Gas</SelectItem>
              <SelectItem value="SERVICIO_AGUA">Agua</SelectItem>
              <SelectItem value="TARJETA_CREDITO">Tarjeta de Crédito</SelectItem>
              <SelectItem value="IMPUESTO_ARBA">ARBA</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
              <SelectItem value="VALIDATING">En Validación</SelectItem>
              <SelectItem value="PROCESSING">Procesando</SelectItem>
              <SelectItem value="FAILED">Fallido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Cargando documentos...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <p className="text-muted-foreground">No se encontraron documentos</p>
            <Link href="/upload">
              <Button className="mt-4">Subir tu primer documento</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Validación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc: any) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.fileName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {doc.classification?.type || 'Desconocido'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[doc.status] || 'default'}>
                      {STATUS_LABELS[doc.status] || doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(doc.createdAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    {doc.validationStatus ? (
                      <Badge
                        variant={
                          doc.validationStatus === 'APPROVED'
                            ? 'success'
                            : doc.validationStatus === 'REJECTED'
                            ? 'destructive'
                            : 'warning'
                        }
                      >
                        {doc.validationStatus === 'APPROVED'
                          ? 'Aprobado'
                          : doc.validationStatus === 'REJECTED'
                          ? 'Rechazado'
                          : 'Pendiente'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/documents/${doc.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
