import { NextRequest } from 'next/server';
import { validateTenant } from '@/lib/middleware/tenant.middleware';
import { prisma } from '@/lib/database/prisma.client';

/**
 * Server-Sent Events (SSE) endpoint para updates en tiempo real
 * El cliente se conecta y recibe actualizaciones de documentos en proceso
 */
export async function GET(request: NextRequest) {
  const validation = await validateTenant(request);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tenantId = validation.tenantId!;

  // Configurar SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Desactivar buffering de Nginx
  });

  // Crear stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Función para enviar evento
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Enviar heartbeat inicial
      sendEvent('connected', { message: 'Connected to document stream' });

      // Poll de cambios cada 2 segundos
      const intervalId = setInterval(async () => {
        try {
          // Obtener documentos en proceso del tenant
          const documents = await prisma.document.findMany({
            where: {
              tenantId,
              status: {
                in: ['QUEUED', 'PROCESSING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING'],
              },
            },
            select: {
              id: true,
              fileName: true,
              status: true,
              classification: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 50, // Límite de 50 documentos activos
          });

          // Enviar update
          sendEvent('documents-update', {
            timestamp: new Date().toISOString(),
            documents,
            count: documents.length,
          });

          // Si no hay documentos en proceso, enviar heartbeat
          if (documents.length === 0) {
            sendEvent('heartbeat', { timestamp: new Date().toISOString() });
          }
        } catch (error) {
          console.error('Error polling documents:', error);
          sendEvent('error', {
            message: 'Error fetching documents',
            timestamp: new Date().toISOString(),
          });
        }
      }, 2000); // Polling cada 2 segundos

      // Cleanup cuando se cierra la conexión
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Cliente desconectado (tenant: ${tenantId})`);
        clearInterval(intervalId);
        controller.close();
      });

      // Timeout después de 5 minutos de inactividad
      setTimeout(() => {
        sendEvent('timeout', { message: 'Connection timeout' });
        clearInterval(intervalId);
        controller.close();
      }, 5 * 60 * 1000);
    },
  });

  return new Response(stream, { headers });
}
