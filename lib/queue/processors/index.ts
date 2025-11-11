// Configurar processors para la cola
import { documentQueue } from '../queue.config'
import { processDocument } from './document.processor'

// Registrar processor para documentos
documentQueue.process(process.env.QUEUE_CONCURRENCY || 5, async (job) => {
  return await processDocument(job)
})

console.log('✅ Cola de procesamiento configurada')

