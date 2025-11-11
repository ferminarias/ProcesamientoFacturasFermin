import Queue from 'bull'
import Redis from 'ioredis'
import { env } from '@/lib/config/env'

// Configurar Redis connection
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

/**
 * Crea una cola de procesamiento para un tenant específico
 * MULTI-TENANT: Cada tenant tiene su propia cola con prefijo
 */
export function createTenantQueue(tenantId: string) {
  return new Queue(`document-processing:${tenantId}`, {
    redis: {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
    },
    defaultJobOptions: {
      attempts: env.MAX_RETRY_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Mantener jobs completados por 1 hora
        count: 1000, // Mantener máximo 1000 jobs completados
      },
      removeOnFail: {
        age: 24 * 3600, // Mantener jobs fallidos por 24 horas
      },
    },
  })
}

/**
 * Cola global para procesamiento (se usa con tenantId en el job data)
 * MULTI-TENANT: Todos los jobs incluyen tenantId para aislamiento
 */
export const documentQueue = new Queue('document-processing-global', {
  redis: {
    host: redis.options.host || 'localhost',
    port: redis.options.port || 6379,
  },
  defaultJobOptions: {
    attempts: env.MAX_RETRY_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
  },
})

// Tipos para los jobs (ahora incluyen tenantId)
export interface DocumentJobData {
  documentId: string
  tenantId: string // MULTI-TENANT: Requerido
  userId: string
  fileName: string
  fileUrl: string
}

export interface DocumentJobResult {
  documentId: string
  tenantId: string
  classification: any
  extractedData: any
  success: boolean
  error?: string
}

// Event listeners para monitoreo
documentQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completado para tenant ${job.data.tenantId}:`, result)
})

documentQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} falló para tenant ${job.data.tenantId}:`, err)
})

documentQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} se quedó estancado para tenant ${job.data.tenantId}`)
})

/**
 * Obtiene estadísticas de la cola para un tenant específico
 */
export async function getTenantQueueStats(tenantId: string) {
  const queue = createTenantQueue(tenantId)
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  })

  await queue.close()

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  }
}

export default documentQueue
