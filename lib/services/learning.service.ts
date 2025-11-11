import { prisma } from '@/lib/db/prisma';
import { DocumentType, LearningRuleType } from '@prisma/client';

/**
 * Sistema de aprendizaje para extracción adaptativa de documentos
 *
 * Este servicio permite:
 * - Obtener configuraciones aprendidas por proveedor/tipo de documento
 * - Aplicar reglas de transformación a datos extraídos
 * - Guardar correcciones de usuario como nuevas reglas
 * - Actualizar prompts y configuraciones basándose en feedback
 */

export interface ExtractionContext {
  tenantId: string;
  documentType: DocumentType;
  supplierName?: string;
  supplierCuit?: string;
}

export interface FieldCorrection {
  field: string;
  originalValue: any;
  correctedValue: any;
  correctionType: 'value' | 'mapping' | 'calculation' | 'regex';
}

/**
 * Obtiene la configuración aprendida para un tipo de documento y proveedor
 */
export async function getLearnedConfiguration(context: ExtractionContext) {
  const { tenantId, documentType, supplierCuit } = context;

  if (!supplierCuit) {
    // Si no hay CUIT, buscar configuración genérica por tipo
    return await prisma.extractionConfiguration.findFirst({
      where: {
        tenantId,
        documentType,
        supplierCuit: null,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });
  }

  // Buscar configuración específica del proveedor
  const config = await prisma.extractionConfiguration.findUnique({
    where: {
      tenantId_documentType_supplierCuit: {
        tenantId,
        documentType,
        supplierCuit,
      },
    },
  });

  return config;
}

/**
 * Obtiene todas las reglas de aprendizaje aplicables a un documento
 */
export async function getLearningRules(context: ExtractionContext, configurationId?: string) {
  const { tenantId, documentType } = context;

  const rules = await prisma.learningRule.findMany({
    where: {
      tenantId,
      documentType,
      ...(configurationId && { configurationId }),
    },
    orderBy: {
      successRate: 'desc',
    },
  });

  return rules;
}

/**
 * Aplica reglas de aprendizaje a los datos extraídos
 */
export function applyLearningRules(extractedData: any, rules: any[], config?: any): any {
  let transformedData = { ...extractedData };

  // 1. Aplicar defaults de la configuración
  if (config?.fieldDefaults) {
    const defaults = config.fieldDefaults as Record<string, any>;
    for (const [field, defaultValue] of Object.entries(defaults)) {
      if (!transformedData[field] || transformedData[field] === '') {
        transformedData[field] = defaultValue;
      }
    }
  }

  // 2. Aplicar mapeos de campos
  if (config?.fieldMappings) {
    const mappings = config.fieldMappings as Record<string, string>;
    for (const [sourceField, targetField] of Object.entries(mappings)) {
      if (transformedData[sourceField] !== undefined) {
        transformedData[targetField] = transformedData[sourceField];
      }
    }
  }

  // 3. Aplicar reglas de transformación
  for (const rule of rules) {
    const { fieldName, ruleType } = rule;

    // Verificar condiciones si existen
    if (rule.conditions && !evaluateConditions(transformedData, rule.conditions)) {
      continue;
    }

    const currentValue = transformedData[fieldName];
    if (currentValue === undefined) continue;

    let newValue: any;

    switch (ruleType) {
      case LearningRuleType.REPLACE:
        if (currentValue === rule.pattern) {
          newValue = rule.replacement;
        }
        break;

      case LearningRuleType.REGEX:
        if (typeof currentValue === 'string' && rule.pattern) {
          try {
            const regex = new RegExp(rule.pattern);
            newValue = currentValue.replace(regex, rule.replacement || '');
          } catch (error) {
            console.error(`Error applying regex rule for ${fieldName}:`, error);
          }
        }
        break;

      case LearningRuleType.MAPPING:
        if (rule.mapping) {
          const mapping = rule.mapping as Record<string, any>;
          newValue = mapping[currentValue] || currentValue;
        }
        break;

      case LearningRuleType.CALCULATION:
        if (rule.formula) {
          try {
            newValue = evaluateFormula(rule.formula, transformedData);
          } catch (error) {
            console.error(`Error evaluating formula for ${fieldName}:`, error);
          }
        }
        break;
    }

    if (newValue !== undefined) {
      transformedData[fieldName] = newValue;

      // Actualizar estadísticas de la regla
      updateRuleStatistics(rule.id, true).catch(console.error);
    }
  }

  return transformedData;
}

/**
 * Guarda correcciones de usuario y genera nuevas reglas de aprendizaje
 */
export async function saveUserCorrections(
  documentId: string,
  userId: string,
  tenantId: string,
  documentType: DocumentType,
  corrections: FieldCorrection[],
  supplierCuit?: string
) {
  // 1. Guardar feedback
  const feedback = await prisma.documentFeedback.create({
    data: {
      documentId,
      userId,
      corrections,
    },
  });

  // 2. Obtener o crear configuración
  let config = await prisma.extractionConfiguration.findFirst({
    where: {
      tenantId,
      documentType,
      supplierCuit: supplierCuit || null,
    },
  });

  if (!config) {
    config = await prisma.extractionConfiguration.create({
      data: {
        tenantId,
        documentType,
        supplierCuit,
        createdBy: userId,
      },
    });
  }

  // 3. Generar reglas de aprendizaje desde las correcciones
  const learningRulesPromises = corrections.map(async (correction) => {
    const { field, originalValue, correctedValue, correctionType } = correction;

    // Detectar tipo de regla basado en la corrección
    let ruleType: LearningRuleType;
    let pattern: string | null = null;
    let replacement: string | null = null;
    let mapping: any = null;
    let formula: string | null = null;

    switch (correctionType) {
      case 'value':
        // Reemplazo simple
        ruleType = LearningRuleType.REPLACE;
        pattern = String(originalValue);
        replacement = String(correctedValue);
        break;

      case 'mapping':
        // Crear mapeo
        ruleType = LearningRuleType.MAPPING;
        mapping = { [originalValue]: correctedValue };
        break;

      case 'regex':
        // Transformación regex
        ruleType = LearningRuleType.REGEX;
        pattern = String(originalValue);
        replacement = String(correctedValue);
        break;

      case 'calculation':
        // Fórmula de cálculo
        ruleType = LearningRuleType.CALCULATION;
        formula = String(correctedValue);
        break;

      default:
        ruleType = LearningRuleType.REPLACE;
        pattern = String(originalValue);
        replacement = String(correctedValue);
    }

    // Verificar si ya existe una regla similar
    const existingRule = await prisma.learningRule.findFirst({
      where: {
        tenantId,
        documentType,
        fieldName: field,
        ruleType,
        pattern,
      },
    });

    if (existingRule) {
      // Actualizar regla existente
      return prisma.learningRule.update({
        where: { id: existingRule.id },
        data: {
          replacement,
          mapping: mapping || existingRule.mapping,
          formula: formula || existingRule.formula,
          timesApplied: existingRule.timesApplied + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      // Crear nueva regla
      return prisma.learningRule.create({
        data: {
          tenantId,
          documentType,
          fieldName: field,
          ruleType,
          pattern,
          replacement,
          mapping,
          formula,
          configurationId: config!.id,
          createdFrom: feedback.id,
        },
      });
    }
  });

  const learningRules = await Promise.all(learningRulesPromises);

  // 4. Actualizar estadísticas de configuración
  await prisma.extractionConfiguration.update({
    where: { id: config.id },
    data: {
      correctionCount: config.correctionCount + 1,
      lastUsedAt: new Date(),
    },
  });

  return { feedback, learningRules };
}

/**
 * Construye un prompt personalizado basado en configuración aprendida
 */
export function buildCustomPrompt(basePrompt: string, config?: any): string {
  if (!config?.customPrompt) {
    return basePrompt;
  }

  return `${basePrompt}

INSTRUCCIONES ADICIONALES APRENDIDAS:
${config.customPrompt}`;
}

/**
 * Actualiza la configuración con un prompt personalizado
 */
export async function updateCustomPrompt(
  configId: string,
  customPrompt: string
) {
  return await prisma.extractionConfiguration.update({
    where: { id: configId },
    data: { customPrompt },
  });
}

/**
 * Marca una configuración como exitosa (incrementa contador)
 */
export async function markConfigurationSuccess(configId: string) {
  const config = await prisma.extractionConfiguration.findUnique({
    where: { id: configId },
  });

  if (config) {
    await prisma.extractionConfiguration.update({
      where: { id: configId },
      data: {
        successCount: config.successCount + 1,
        lastUsedAt: new Date(),
      },
    });
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Evalúa condiciones para aplicar una regla
 */
function evaluateConditions(data: any, conditions: any): boolean {
  // Implementación simple de evaluación de condiciones
  // Ejemplo de conditions: { "campo": "valor", "otro_campo": { "$gt": 100 } }

  for (const [field, condition] of Object.entries(conditions)) {
    const value = data[field];

    if (typeof condition === 'object' && condition !== null) {
      // Operadores
      for (const [operator, expected] of Object.entries(condition)) {
        switch (operator) {
          case '$eq':
            if (value !== expected) return false;
            break;
          case '$ne':
            if (value === expected) return false;
            break;
          case '$gt':
            if (!(value > expected)) return false;
            break;
          case '$gte':
            if (!(value >= expected)) return false;
            break;
          case '$lt':
            if (!(value < expected)) return false;
            break;
          case '$lte':
            if (!(value <= expected)) return false;
            break;
          case '$in':
            if (!Array.isArray(expected) || !expected.includes(value)) return false;
            break;
        }
      }
    } else {
      // Comparación directa
      if (value !== condition) return false;
    }
  }

  return true;
}

/**
 * Evalúa una fórmula simple
 */
function evaluateFormula(formula: string, data: any): any {
  // Implementación básica de evaluación de fórmulas
  // Soporta referencias a campos con ${campo} y operaciones matemáticas simples

  let evaluatedFormula = formula;

  // Reemplazar referencias a campos
  const fieldReferences = formula.match(/\$\{(\w+)\}/g);
  if (fieldReferences) {
    for (const ref of fieldReferences) {
      const fieldName = ref.slice(2, -1); // Quitar ${ y }
      const value = data[fieldName] || 0;
      evaluatedFormula = evaluatedFormula.replace(ref, String(value));
    }
  }

  // Evaluar expresión matemática (usando Function es más seguro que eval)
  try {
    // Sanitizar la fórmula para evitar inyección
    const sanitized = evaluatedFormula.replace(/[^0-9+\-*/(). ]/g, '');
    const result = Function(`"use strict"; return (${sanitized})`)();
    return result;
  } catch (error) {
    console.error('Error evaluating formula:', error);
    return null;
  }
}

/**
 * Actualiza estadísticas de una regla
 */
async function updateRuleStatistics(ruleId: string, success: boolean) {
  const rule = await prisma.learningRule.findUnique({
    where: { id: ruleId },
  });

  if (rule) {
    const newTimesApplied = rule.timesApplied + 1;
    const successCount = success
      ? Math.round(rule.successRate * rule.timesApplied) + 1
      : Math.round(rule.successRate * rule.timesApplied);

    const newSuccessRate = successCount / newTimesApplied;

    await prisma.learningRule.update({
      where: { id: ruleId },
      data: {
        timesApplied: newTimesApplied,
        successRate: newSuccessRate,
      },
    });
  }
}
