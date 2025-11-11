'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  documentId?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
  });

  const uploadFile = async (index: number) => {
    const uploadFile = files[index];
    if (!uploadFile) return;

    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: 'uploading' as const } : f
      )
    );

    const formData = new FormData();
    formData.append('file', uploadFile.file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setFiles((prev) =>
            prev.map((f, i) => (i === index ? { ...f, progress } : f))
          );
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index
                ? {
                    ...f,
                    status: 'success' as const,
                    progress: 100,
                    documentId: response.documentId,
                  }
                : f
            )
          );
          toast({
            title: 'Archivo subido',
            description: 'El documento se está procesando',
          });
        } else {
          throw new Error('Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: 'error' as const,
                  error: 'Error al subir el archivo',
                }
              : f
          )
        );
      });

      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('x-tenant-id', 'acme-corp');
      xhr.send(formData);
    } catch (error) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: 'error' as const,
                error: 'Error al subir el archivo',
              }
            : f
        )
      );
      toast({
        title: 'Error',
        description: 'No se pudo subir el archivo',
        variant: 'destructive',
      });
    }
  };

  const uploadAll = async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await uploadFile(i);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subir Documentos</h1>
        <p className="text-muted-foreground">
          Arrastra archivos o haz clic para seleccionar
        </p>
      </div>

      <Card className="p-6">
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">
            {isDragActive
              ? 'Suelta los archivos aquí'
              : 'Arrastra archivos aquí o haz clic para seleccionar'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Soporta imágenes (PNG, JPG, GIF, WebP) y PDFs
          </p>
        </div>
      </Card>

      {files.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Archivos ({files.length})
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={clearCompleted}
                variant="outline"
                size="sm"
                disabled={!files.some((f) => f.status === 'success')}
              >
                Limpiar completados
              </Button>
              <Button
                onClick={uploadAll}
                size="sm"
                disabled={!files.some((f) => f.status === 'pending')}
              >
                Subir todos
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {files.map((uploadFile, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5" />
                </div>

                <div className="flex-1">
                  <p className="font-medium">{uploadFile.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uploadFile.file.size / 1024).toFixed(2)} KB
                  </p>
                  {uploadFile.status === 'uploading' && (
                    <Progress value={uploadFile.progress} className="mt-2" />
                  )}
                  {uploadFile.status === 'error' && (
                    <p className="mt-1 text-sm text-destructive">
                      {uploadFile.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {uploadFile.status === 'pending' && (
                    <Button onClick={() => uploadFile(index)} size="sm">
                      Subir
                    </Button>
                  )}
                  {uploadFile.status === 'uploading' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      {uploadFile.progress.toFixed(0)}%
                    </div>
                  )}
                  {uploadFile.status === 'success' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      {uploadFile.documentId && (
                        <Button
                          onClick={() =>
                            router.push(`/documents/${uploadFile.documentId}`)
                          }
                          size="sm"
                          variant="outline"
                        >
                          Ver
                        </Button>
                      )}
                    </div>
                  )}
                  {uploadFile.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <Button
                    onClick={() => removeFile(index)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
