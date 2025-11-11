import { useEffect, useState, useCallback } from 'react';

interface Document {
  id: string;
  fileName: string;
  status: string;
  classification: any;
  createdAt: string;
  updatedAt: string;
}

interface StreamState {
  documents: Document[];
  isConnected: boolean;
  error: string | null;
  lastUpdate: string | null;
}

/**
 * Hook para conectarse al stream de documentos en tiempo real
 * Usa Server-Sent Events (SSE) para recibir updates
 */
export function useDocumentStream(tenantId: string) {
  const [state, setState] = useState<StreamState>({
    documents: [],
    isConnected: false,
    error: null,
    lastUpdate: null,
  });

  const connect = useCallback(() => {
    if (!tenantId) return;

    console.log('[SSE] Conectando al stream...');

    const eventSource = new EventSource(
      `/api/documents/stream?tenant=${tenantId}`,
      {
        withCredentials: true,
      }
    );

    // Evento: connected
    eventSource.addEventListener('connected', (event) => {
      console.log('[SSE] Conectado:', event.data);
      setState((prev) => ({
        ...prev,
        isConnected: true,
        error: null,
      }));
    });

    // Evento: documents-update
    eventSource.addEventListener('documents-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Documentos actualizados:', data.count);

        setState((prev) => ({
          ...prev,
          documents: data.documents,
          lastUpdate: data.timestamp,
        }));
      } catch (error) {
        console.error('[SSE] Error parsing documents-update:', error);
      }
    });

    // Evento: heartbeat
    eventSource.addEventListener('heartbeat', (event) => {
      const data = JSON.parse(event.data);
      setState((prev) => ({
        ...prev,
        lastUpdate: data.timestamp,
      }));
    });

    // Evento: error
    eventSource.addEventListener('error', (event: any) => {
      if (event.data) {
        try {
          const data = JSON.parse(event.data);
          console.error('[SSE] Error del servidor:', data.message);
          setState((prev) => ({
            ...prev,
            error: data.message,
          }));
        } catch (e) {
          // Error genérico
        }
      }
    });

    // Error de conexión
    eventSource.onerror = (error) => {
      console.error('[SSE] Error de conexión:', error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: 'Connection lost',
      }));

      // Intentar reconectar después de 5 segundos
      setTimeout(() => {
        console.log('[SSE] Intentando reconectar...');
        eventSource.close();
        connect();
      }, 5000);
    };

    // Evento: timeout
    eventSource.addEventListener('timeout', () => {
      console.log('[SSE] Timeout, cerrando conexión');
      eventSource.close();
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
    });

    return () => {
      console.log('[SSE] Cerrando conexión');
      eventSource.close();
    };
  }, [tenantId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return state;
}

/**
 * Hook para obtener el progreso de un documento específico
 */
export function useDocumentProgress(documentId: string) {
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('QUEUED');

  useEffect(() => {
    if (!documentId) return;

    // Mapeo de estados a porcentaje de progreso
    const statusProgress: Record<string, number> = {
      QUEUED: 0,
      PROCESSING: 20,
      CLASSIFYING: 40,
      EXTRACTING: 60,
      VALIDATING: 80,
      COMPLETED: 100,
      FAILED: 0,
    };

    const eventSource = new EventSource(
      `/api/documents/stream`,
      { withCredentials: true }
    );

    eventSource.addEventListener('documents-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        const doc = data.documents.find((d: any) => d.id === documentId);

        if (doc) {
          setStatus(doc.status);
          setProgress(statusProgress[doc.status] || 0);
        }
      } catch (error) {
        console.error('[Progress] Error:', error);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [documentId]);

  return { progress, status };
}
