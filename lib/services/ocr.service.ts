import { prisma } from '@/lib/db/prisma';
import { OCRProvider } from '@prisma/client';
import vision from '@google-cloud/vision';
import { put } from '@vercel/blob';

/**
 * Servicio de OCR - Layer separado antes de la extracción
 *
 * Estrategia:
 * - Fotos/imágenes de baja calidad → Google Vision OCR
 * - PDFs limpios → Extracción directa de texto
 * - PDFs escaneados → Google Vision OCR
 */

export interface OCROptions {
  provider?: 'auto' | 'google-vision' | 'direct-pdf';
  language?: string;
  detectHandwriting?: boolean;
}

export interface OCRResult {
  rawText: string;
  confidence: number;
  provider: OCRProvider;
  language?: string;
  pageCount?: number;
  hasHandwriting?: boolean;
  imageQuality?: 'LOW' | 'MEDIUM' | 'HIGH';
  blocks?: any[];
  words?: any[];
  processingTime: number;
  costEstimate: number;
}

/**
 * Procesa un documento y extrae texto con OCR
 */
export async function processOCR(
  fileUrl: string,
  mimeType: string,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  // Determinar qué proveedor usar
  const provider = options.provider || 'auto';
  let selectedProvider: OCRProvider;

  if (provider === 'auto') {
    selectedProvider = selectBestProvider(mimeType);
  } else if (provider === 'google-vision') {
    selectedProvider = OCRProvider.GOOGLE_VISION;
  } else {
    selectedProvider = OCRProvider.DIRECT_PDF;
  }

  let result: OCRResult;

  try {
    switch (selectedProvider) {
      case OCRProvider.GOOGLE_VISION:
        result = await processWithGoogleVision(fileUrl, options);
        break;

      case OCRProvider.DIRECT_PDF:
        result = await processDirectPDF(fileUrl);
        break;

      default:
        throw new Error(`Proveedor OCR no soportado: ${selectedProvider}`);
    }

    result.processingTime = Date.now() - startTime;
    return result;
  } catch (error) {
    console.error('Error en OCR:', error);
    throw new Error(`Error procesando OCR: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Procesa con Google Cloud Vision API
 */
async function processWithGoogleVision(
  fileUrl: string,
  options: OCROptions
): Promise<OCRResult> {
  // Verificar si está configurado Google Vision
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
    console.warn('Google Vision no configurado, usando fallback');
    return processDirectPDF(fileUrl);
  }

  try {
    // Inicializar cliente de Google Vision
    const client = new vision.ImageAnnotatorClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
    });

    // Procesar imagen
    const [result] = await client.documentTextDetection(fileUrl);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return {
        rawText: '',
        confidence: 0,
        provider: OCRProvider.GOOGLE_VISION,
        processingTime: 0,
        costEstimate: 0.0015, // $1.50 per 1000 images
        imageQuality: 'LOW',
      };
    }

    // El primer elemento contiene todo el texto
    const fullText = detections[0]?.description || '';

    // Calcular confidence promedio
    const confidences = detections
      .slice(1)
      .map((d) => d.confidence || 0)
      .filter((c) => c > 0);
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    // Detectar calidad de imagen
    const imageQuality = avgConfidence > 0.9 ? 'HIGH' : avgConfidence > 0.7 ? 'MEDIUM' : 'LOW';

    // Extraer bloques y palabras (opcional)
    const fullTextAnnotation = result.fullTextAnnotation;
    const blocks = fullTextAnnotation?.pages?.[0]?.blocks?.map((block) => ({
      text: block.paragraphs
        ?.map((p) => p.words?.map((w) => w.symbols?.map((s) => s.text).join('')).join(' '))
        .join(' '),
      confidence: block.confidence,
      boundingBox: block.boundingBox,
    }));

    return {
      rawText: fullText,
      confidence: avgConfidence,
      provider: OCRProvider.GOOGLE_VISION,
      language: detections[0]?.locale || 'es',
      pageCount: 1,
      hasHandwriting: false, // TODO: detectar caligrafía
      imageQuality,
      blocks,
      processingTime: 0,
      costEstimate: 0.0015,
    };
  } catch (error) {
    console.error('Error en Google Vision:', error);
    // Fallback a extracción directa
    return processDirectPDF(fileUrl);
  }
}

/**
 * Extracción directa de PDF (sin OCR)
 */
async function processDirectPDF(fileUrl: string): Promise<OCRResult> {
  try {
    // Descargar el PDF
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('No se pudo descargar el archivo');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Importar dinámicamente pdf-parse
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);

    return {
      rawText: pdfData.text,
      confidence: 1.0, // PDF nativo tiene 100% confidence
      provider: OCRProvider.DIRECT_PDF,
      pageCount: pdfData.numpages,
      imageQuality: 'HIGH',
      processingTime: 0,
      costEstimate: 0, // Gratis
    };
  } catch (error) {
    console.error('Error extrayendo PDF:', error);
    throw new Error('No se pudo extraer texto del PDF');
  }
}

/**
 * Selecciona el mejor proveedor de OCR según el tipo de archivo
 */
function selectBestProvider(mimeType: string): OCRProvider {
  // PDFs limpios → extracción directa
  if (mimeType === 'application/pdf') {
    return OCRProvider.DIRECT_PDF;
  }

  // Imágenes → Google Vision
  if (mimeType.startsWith('image/')) {
    return OCRProvider.GOOGLE_VISION;
  }

  // Por defecto: Google Vision
  return OCRProvider.GOOGLE_VISION;
}

/**
 * Guarda resultado de OCR en la base de datos
 */
export async function saveOCRResult(
  documentId: string,
  tenantId: string,
  result: OCRResult
) {
  return await prisma.oCRResult.create({
    data: {
      documentId,
      tenantId,
      provider: result.provider,
      rawText: result.rawText,
      confidence: result.confidence,
      language: result.language,
      pageCount: result.pageCount,
      hasHandwriting: result.hasHandwriting || false,
      imageQuality: result.imageQuality,
      blocks: result.blocks,
      words: result.words,
      processingTime: result.processingTime,
      costEstimate: result.costEstimate,
    },
  });
}

/**
 * Obtiene resultado de OCR de un documento
 */
export async function getOCRResult(documentId: string) {
  return await prisma.oCRResult.findUnique({
    where: { documentId },
  });
}

/**
 * Analiza la calidad de un documento para decidir estrategia de OCR
 */
export function analyzeDocumentQuality(
  mimeType: string,
  fileSize: number
): {
  suggestedProvider: OCRProvider;
  estimatedCost: number;
  estimatedTime: number;
  reason: string;
} {
  // PDF grande y limpio
  if (mimeType === 'application/pdf' && fileSize > 500000) {
    return {
      suggestedProvider: OCRProvider.DIRECT_PDF,
      estimatedCost: 0,
      estimatedTime: 2000, // 2 segundos
      reason: 'PDF grande, extracción directa más eficiente',
    };
  }

  // Imagen pequeña
  if (mimeType.startsWith('image/') && fileSize < 100000) {
    return {
      suggestedProvider: OCRProvider.GOOGLE_VISION,
      estimatedCost: 0.0015,
      estimatedTime: 3000, // 3 segundos
      reason: 'Imagen pequeña, Google Vision para mejor precision',
    };
  }

  // Imagen grande
  if (mimeType.startsWith('image/') && fileSize > 1000000) {
    return {
      suggestedProvider: OCRProvider.GOOGLE_VISION,
      estimatedCost: 0.0015,
      estimatedTime: 5000, // 5 segundos
      reason: 'Imagen grande, requiere OCR potente',
    };
  }

  // PDF pequeño
  if (mimeType === 'application/pdf') {
    return {
      suggestedProvider: OCRProvider.DIRECT_PDF,
      estimatedCost: 0,
      estimatedTime: 1000, // 1 segundo
      reason: 'PDF pequeño, extracción directa rápida',
    };
  }

  // Default: Google Vision
  return {
    suggestedProvider: OCRProvider.GOOGLE_VISION,
    estimatedCost: 0.0015,
    estimatedTime: 3000,
    reason: 'Formato desconocido, usando Google Vision por seguridad',
  };
}
