import { prisma } from '@/lib/database/prisma.client';

/**
 * Servicio de aprendizaje automático basado en feedback de usuarios
 * Analiza correcciones para mejorar prompts y precisión
 */
export class LearningService {
  /**
   * Registra feedback de usuario cuando corrige datos extraídos
   */
  static async recordFeedback(params: {
    documentId: string;
    tenantId: string;
    originalData: any;
    correctedData: any;
    userId?: string;
  }) {
    const { documentId, tenantId, originalData, correctedData, userId } = params;

    // Encontrar diferencias entre original y corregido
    const corrections = this.findDifferences(originalData, correctedData);

    if (corrections.length === 0) {
      console.log('[Learning] No se encontraron correcciones');
      return null;
    }

    // Guardar feedback en base de datos
    const feedback = await prisma.documentFeedback.create({
      data: {
        documentId,
        originalData: originalData as any,
        correctedData: correctedData as any,
        corrections: corrections as any,
        userId,
      },
    });

    console.log(`[Learning] Registrado feedback con ${corrections.length} correcciones`);

    return feedback;
  }

  /**
   * Encuentra diferencias entre dos objetos
   */
  private static findDifferences(original: any, corrected: any, path: string = ''): Array<{
    field: string;
    originalValue: any;
    correctedValue: any;
    correctionType: string;
  }> {
    const corrections: any[] = [];

    // Comparar cada campo
    for (const key in corrected) {
      const fullPath = path ? `${path}.${key}` : key;
      const originalValue = original?.[key];
      const correctedValue = corrected[key];

      // Si los valores son diferentes
      if (JSON.stringify(originalValue) !== JSON.stringify(correctedValue)) {
        // Determinar tipo de corrección
        let correctionType = 'modification';

        if (originalValue === null || originalValue === undefined) {
          correctionType = 'addition';
        } else if (typeof originalValue === 'string' && typeof correctedValue === 'string') {
          // Detectar typos (similitud > 80%)
          const similarity = this.stringSimilarity(originalValue, correctedValue);
          if (similarity > 0.8) {
            correctionType = 'typo';
          }
        } else if (typeof originalValue === 'number' && typeof correctedValue === 'number') {
          correctionType = 'numeric_correction';
        }

        corrections.push({
          field: fullPath,
          originalValue,
          correctedValue,
          correctionType,
        });
      }

      // Recursivo para objetos anidados
      if (
        typeof correctedValue === 'object' &&
        correctedValue !== null &&
        !Array.isArray(correctedValue)
      ) {
        const nestedCorrections = this.findDifferences(
          originalValue || {},
          correctedValue,
          fullPath
        );
        corrections.push(...nestedCorrections);
      }
    }

    return corrections;
  }

  /**
   * Calcula similitud entre dos strings (Levenshtein simplificado)
   */
  private static stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Distancia de Levenshtein (número de ediciones para transformar un string en otro)
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Obtiene estadísticas de feedback para análisis
   */
  static async getFeedbackStats(tenantId: string) {
    const feedbacks = await prisma.documentFeedback.findMany({
      where: {
        document: { tenantId },
      },
      include: {
        document: {
          select: {
            classification: true,
          },
        },
      },
    });

    // Agrupar por tipo de documento
    const byType: Record<string, any> = {};

    feedbacks.forEach((feedback) => {
      const docType = (feedback.document.classification as any)?.type || 'unknown';

      if (!byType[docType]) {
        byType[docType] = {
          type: docType,
          totalCorrections: 0,
          correctionTypes: {} as Record<string, number>,
          commonFields: {} as Record<string, number>,
        };
      }

      const corrections = feedback.corrections as any[];
      byType[docType].totalCorrections += corrections.length;

      corrections.forEach((correction: any) => {
        // Contar tipos de corrección
        byType[docType].correctionTypes[correction.correctionType] =
          (byType[docType].correctionTypes[correction.correctionType] || 0) + 1;

        // Contar campos más corregidos
        byType[docType].commonFields[correction.field] =
          (byType[docType].commonFields[correction.field] || 0) + 1;
      });
    });

    return {
      totalFeedbacks: feedbacks.length,
      byType: Object.values(byType),
    };
  }

  /**
   * Genera recomendaciones para mejorar prompts basado en feedback
   */
  static async generatePromptImprovements(documentType: string, tenantId: string) {
    const feedbacks = await prisma.documentFeedback.findMany({
      where: {
        document: {
          tenantId,
          classification: {
            path: ['type'],
            equals: documentType,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Últimos 50 feedbacks
    });

    if (feedbacks.length === 0) {
      return null;
    }

    // Analizar correcciones más comunes
    const fieldCorrections: Record<string, number> = {};
    const typos: Array<{ original: string; corrected: string }> = [];

    feedbacks.forEach((feedback) => {
      const corrections = feedback.corrections as any[];

      corrections.forEach((correction: any) => {
        fieldCorrections[correction.field] =
          (fieldCorrections[correction.field] || 0) + 1;

        if (correction.correctionType === 'typo') {
          typos.push({
            original: correction.originalValue,
            corrected: correction.correctedValue,
          });
        }
      });
    });

    // Campos más problemáticos (top 5)
    const problematicFields = Object.entries(fieldCorrections)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([field, count]) => ({
        field,
        correctionCount: count,
        percentage: ((count / feedbacks.length) * 100).toFixed(1),
      }));

    return {
      documentType,
      feedbackCount: feedbacks.length,
      problematicFields,
      typos: typos.slice(0, 10), // Top 10 typos
      recommendation:
        problematicFields.length > 0
          ? `Los campos ${problematicFields.map((f) => f.field).join(', ')} necesitan mejoras en el prompt de extracción.`
          : 'El extractor está funcionando correctamente.',
    };
  }
}
