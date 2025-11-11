/**
 * Worker independiente para procesamiento de documentos
 * Se ejecuta como proceso separado para escalar horizontalmente
 */

import { Queue, Worker, Job } from 'bull';
import { prisma } from '../lib/database/prisma.client';
import { DocumentClassifier } from '../lib/services/classifier';
import { FacturaExtractor } from '../lib/services/extractors/factura.extractor';
import { ServicioExtractor } from '../lib/services/extractors/servicio.extractor';
import { ImpuestoExtractor } from '../lib/services/extractors/impuesto.extractor';
import { TarjetaExtractor } from '../lib/services/extractors/tarjeta.extractor';
import { AutomationEngine } from '../lib/services/automation/engine';
import { redisConfig } from '../lib/queue/queue.config';
import IORedis from 'ioredis';

// Configurar Redis connection
const redisClient = new IORedis(redisConfig);

// Crear queue
const documentQueue = new Queue('document-processing', {
  redis: redisClient as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Mantener últimos 100 completados
    removeOnFail: false, // Mantener fallidos para debug
  },
});

// Mapeo de extractores por tipo
const extractors: Record<string, any> = {
  FACTURA_A: new FacturaExtractor(),
  FACTURA_B: new FacturaExtractor(),
  FACTURA_C: new FacturaExtractor(),
  FACTURA_E: new FacturaExtractor(),
  FACTURA_M: new FacturaExtractor(),
  SERVICIO_LUZ: new ServicioExtractor(),
  SERVICIO_GAS: new ServicioExtractor(),
  SERVICIO_AGUA: new ServicioExtractor(),
  SERVICIO_INTERNET: new ServicioExtractor(),
  SERVICIO_TELEFONIA: new ServicioExtractor(),
  SERVICIO_CABLE: new ServicioExtractor(),
  IMPUESTO_ARBA: new ImpuestoExtractor(),
  IMPUESTO_ABL: new ImpuestoExtractor(),
  IMPUESTO_PATENTE: new ImpuestoExtractor(),
  IMPUESTO_IIBB: new ImpuestoExtractor(),
  IMPUESTO_MONOTRIBUTO: new ImpuestoExtractor(),
  IMPUESTO_GANANCIAS: new ImpuestoExtractor(),
  RESUMEN_TARJETA: new TarjetaExtractor(),
};

/**
 * Procesar un documento
 */
async function processDocument(job: Job) {
  const { documentId, tenantId } = job.data;

  console.log(`[Worker] Procesando documento ${documentId} (tenant: ${tenantId})`);

  try {
    // 1. Obtener documento
    const document = await prisma.document.findUnique({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // 2. Actualizar estado a CLASSIFYING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'CLASSIFYING' },
    });

    await job.progress(20);

    // 3. Clasificar documento
    console.log(`[Worker] Clasificando documento ${documentId}...`);
    const classifier = new DocumentClassifier();
    const classification = await classifier.classifyDocument(document.fileUrl);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        classification: classification as any,
        status: 'EXTRACTING',
      },
    });

    await job.progress(50);

    // 4. Extraer datos según tipo
    console.log(`[Worker] Extrayendo datos de ${classification.type}...`);
    const extractor = extractors[classification.type];

    if (!extractor) {
      throw new Error(`No extractor found for type: ${classification.type}`);
    }

    const extractedData = await extractor.extractFromImage(document.fileUrl);

    await job.progress(80);

    // 5. Actualizar documento con datos extraídos
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedData: extractedData as any,
        status: 'VALIDATING',
        processedAt: new Date(),
      },
    });

    await job.progress(90);

    // 6. Trigger automatizaciones
    console.log(`[Worker] Procesando automatizaciones para ${documentId}...`);
    await AutomationEngine.processEvent({
      type: 'document.processed',
      documentId,
      documentType: classification.type,
      tenantId,
    });

    await job.progress(100);

    console.log(`[Worker] ✅ Documento ${documentId} procesado exitosamente`);

    return {
      success: true,
      documentId,
      classification,
    };
  } catch (error: any) {
    console.error(`[Worker] ❌ Error procesando documento ${documentId}:`, error);

    // Actualizar documento como fallido
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        retryCount: {
          increment: 1,
        },
      },
    });

    throw error; // Re-throw para que Bull maneje el retry
  }
}

/**
 * Crear worker con concurrencia
 */
const worker = new Worker(
  'document-processing',
  processDocument,
  {
    redis: redisClient as any,
    concurrency: 5, // Procesar 5 documentos simultáneamente
  }
);

// Event listeners
worker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completado:`, result);
});

worker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} falló:`, error.message);

  // Si falló 3 veces, marcar como definitivamente fallido
  if (job && job.attemptsMade >= 3) {
    console.error(`[Worker] Job ${job.id} falló definitivamente después de 3 intentos`);
  }
});

worker.on('error', (error) => {
  console.error('[Worker] Error en worker:', error);
});

worker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled (puede estar bloqueado)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Recibiendo señal SIGTERM, cerrando gracefully...');
  await worker.close();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Recibiendo señal SIGINT, cerrando gracefully...');
  await worker.close();
  await redisClient.quit();
  process.exit(0);
});

console.log('🚀 Worker iniciado correctamente');
console.log(`📊 Concurrencia: 5 documentos simultáneos`);
console.log(`🔄 Retry: 3 intentos con backoff exponencial`);
console.log('👀 Esperando trabajos...');

// Keep alive
setInterval(() => {
  console.log(`[Worker] Activo - Jobs pendientes: ${documentQueue.getWaiting().then(jobs => jobs.length)}`);
}, 30000); // Log cada 30 segundos
