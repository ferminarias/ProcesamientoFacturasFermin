import { prisma } from '@/lib/db/prisma';
import { DocumentType, FieldType } from '@prisma/client';

/**
 * Servicio de Templates Personalizables
 *
 * Permite a los usuarios crear "mini prompts" para tipos específicos de documentos
 * Cada template define qué campos extraer y cómo hacerlo
 */

export interface CreateTemplateInput {
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  documentType?: DocumentType;
  customPrompt: string;
  systemPrompt?: string;
  fields: TemplateFieldInput[];
  autoDetect?: boolean;
  detectionRules?: any;
  validationRules?: any;
  requiredFields?: string[];
  askIfMissing?: boolean;
  allowConversation?: boolean;
}

export interface TemplateFieldInput {
  name: string;
  label: string;
  description?: string;
  fieldType: FieldType;
  isRequired?: boolean;
  isArray?: boolean;
  options?: any;
  allowCustom?: boolean;
  validation?: any;
  defaultValue?: any;
  extractionHint?: string;
  fallbackField?: string;
  order?: number;
  group?: string;
}

/**
 * Crea un nuevo template personalizable
 */
export async function createTemplate(input: CreateTemplateInput) {
  const template = await prisma.documentTemplate.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      name: input.name,
      description: input.description,
      documentType: input.documentType,
      customPrompt: input.customPrompt,
      systemPrompt: input.systemPrompt,
      autoDetect: input.autoDetect || false,
      detectionRules: input.detectionRules,
      validationRules: input.validationRules,
      requiredFields: input.requiredFields || [],
      askIfMissing: input.askIfMissing !== false,
      allowConversation: input.allowConversation !== false,
      fields: {
        create: input.fields.map((field, index) => ({
          name: field.name,
          label: field.label,
          description: field.description,
          fieldType: field.fieldType,
          isRequired: field.isRequired || false,
          isArray: field.isArray || false,
          options: field.options,
          allowCustom: field.allowCustom || false,
          validation: field.validation,
          defaultValue: field.defaultValue,
          extractionHint: field.extractionHint,
          fallbackField: field.fallbackField,
          order: field.order !== undefined ? field.order : index,
          group: field.group,
        })),
      },
    },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return template;
}

/**
 * Obtiene un template por ID
 */
export async function getTemplate(templateId: string, tenantId: string) {
  return await prisma.documentTemplate.findFirst({
    where: {
      id: templateId,
      OR: [
        { tenantId },
        { isPublic: true },
      ],
    },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

/**
 * Lista templates de un tenant
 */
export async function listTemplates(tenantId: string, userId?: string) {
  return await prisma.documentTemplate.findMany({
    where: {
      AND: [
        {
          OR: [
            { tenantId },
            { isPublic: true },
          ],
        },
        userId ? { userId } : {},
      ],
      isActive: true,
    },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { documents: true },
      },
    },
    orderBy: [
      { timesUsed: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

/**
 * Auto-detecta qué template usar para un documento
 */
export async function detectTemplate(
  tenantId: string,
  documentType?: DocumentType,
  ocrText?: string
): Promise<any | null> {
  // Buscar templates con auto-detección habilitada
  const candidates = await prisma.documentTemplate.findMany({
    where: {
      tenantId,
      autoDetect: true,
      isActive: true,
      ...(documentType && { documentType }),
    },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: {
      successRate: 'desc',
    },
  });

  if (candidates.length === 0) return null;

  // Evaluar reglas de detección
  for (const template of candidates) {
    if (!template.detectionRules || !ocrText) continue;

    const rules = template.detectionRules as any;

    // Regla: contiene keywords
    if (rules.keywords && Array.isArray(rules.keywords)) {
      const matchCount = rules.keywords.filter((keyword: string) =>
        ocrText.toLowerCase().includes(keyword.toLowerCase())
      ).length;

      const threshold = rules.keywordThreshold || rules.keywords.length * 0.5;
      if (matchCount >= threshold) {
        return template;
      }
    }

    // Regla: regex
    if (rules.regex) {
      try {
        const regex = new RegExp(rules.regex, 'i');
        if (regex.test(ocrText)) {
          return template;
        }
      } catch (error) {
        console.error('Error en regex de detección:', error);
      }
    }

    // Regla: proveedor específico (CUIT, nombre)
    if (rules.supplierCuit) {
      const cuitNormalized = rules.supplierCuit.replace(/[^0-9]/g, '');
      if (ocrText.includes(cuitNormalized)) {
        return template;
      }
    }
  }

  return null;
}

/**
 * Construye un prompt dinámico basado en el template
 */
export function buildPromptFromTemplate(template: any, ocrText?: string): string {
  const fields = template.fields || [];

  // Construir schema JSON esperado
  const schema: any = {};
  const fieldDescriptions: string[] = [];

  for (const field of fields) {
    // Determinar tipo JSON
    let jsonType = 'string';
    let example: any = '';

    switch (field.fieldType) {
      case 'NUMBER':
      case 'CURRENCY':
      case 'PERCENTAGE':
        jsonType = 'number';
        example = 0;
        break;
      case 'BOOLEAN':
        jsonType = 'boolean';
        example = false;
        break;
      case 'DATE':
      case 'DATETIME':
        jsonType = 'string';
        example = 'YYYY-MM-DD';
        break;
      case 'SELECT':
        jsonType = 'string';
        if (field.options && Array.isArray(field.options)) {
          example = field.options[0];
        }
        break;
      case 'MULTI_SELECT':
        jsonType = 'array';
        example = [];
        break;
      case 'JSON':
        jsonType = 'object';
        example = {};
        break;
    }

    if (field.isArray) {
      schema[field.name] = [example];
    } else {
      schema[field.name] = example;
    }

    // Descripción del campo
    let desc = `"${field.name}": ${field.label}`;
    if (field.description) {
      desc += ` - ${field.description}`;
    }
    if (field.isRequired) {
      desc += ' (REQUERIDO)';
    }
    if (field.extractionHint) {
      desc += ` [Hint: ${field.extractionHint}]`;
    }
    if (field.options && field.fieldType === 'SELECT') {
      desc += ` (Opciones: ${JSON.stringify(field.options)})`;
    }

    fieldDescriptions.push(desc);
  }

  // Construir prompt completo
  let prompt = '';

  // System prompt (si existe)
  if (template.systemPrompt) {
    prompt += template.systemPrompt + '\n\n';
  }

  // Custom prompt del usuario
  prompt += template.customPrompt + '\n\n';

  // Schema JSON esperado
  prompt += 'EXTRAE los siguientes datos en formato JSON:\n\n';
  prompt += 'Campos a extraer:\n';
  fieldDescriptions.forEach((desc) => {
    prompt += `- ${desc}\n`;
  });

  prompt += '\nJSON ESPERADO:\n';
  prompt += '```json\n' + JSON.stringify(schema, null, 2) + '\n```\n\n';

  // Validaciones
  if (template.validationRules) {
    prompt += 'VALIDACIONES:\n';
    for (const [field, rule] of Object.entries(template.validationRules)) {
      prompt += `- ${field}: ${rule}\n`;
    }
    prompt += '\n';
  }

  // Instrucciones finales
  prompt += 'IMPORTANTE:\n';
  prompt += '- Responde SOLO con el JSON, sin texto adicional\n';
  prompt += '- Si un campo no se encuentra, usa null\n';
  prompt += '- Mantén los tipos de datos correctos (números como números, no strings)\n';
  if (template.requiredFields && template.requiredFields.length > 0) {
    prompt += `- Campos obligatorios: ${template.requiredFields.join(', ')}\n`;
  }

  return prompt;
}

/**
 * Valida datos extraídos contra el template
 */
export function validateExtractedData(
  data: any,
  template: any
): {
  isValid: boolean;
  missingFields: string[];
  invalidFields: Array<{ field: string; error: string }>;
  confidence: number;
} {
  const missingFields: string[] = [];
  const invalidFields: Array<{ field: string; error: string }> = [];

  for (const field of template.fields) {
    const value = data[field.name];

    // Verificar campos requeridos
    if (field.isRequired && (value === null || value === undefined || value === '')) {
      missingFields.push(field.name);
      continue;
    }

    // Validar tipo
    if (value !== null && value !== undefined) {
      const validationResult = validateFieldValue(value, field);
      if (!validationResult.isValid) {
        invalidFields.push({
          field: field.name,
          error: validationResult.error || 'Tipo inválido',
        });
      }
    }
  }

  // Calcular confidence
  const totalFields = template.fields.length;
  const validFields = totalFields - missingFields.length - invalidFields.length;
  const confidence = totalFields > 0 ? validFields / totalFields : 0;

  return {
    isValid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
    confidence,
  };
}

/**
 * Valida un valor individual contra su definición de campo
 */
function validateFieldValue(
  value: any,
  field: any
): { isValid: boolean; error?: string } {
  // Validar tipo básico
  switch (field.fieldType) {
    case 'NUMBER':
    case 'CURRENCY':
    case 'PERCENTAGE':
      if (typeof value !== 'number' || isNaN(value)) {
        return { isValid: false, error: 'Debe ser un número' };
      }
      break;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        return { isValid: false, error: 'Debe ser true o false' };
      }
      break;
    case 'DATE':
    case 'DATETIME':
      if (typeof value !== 'string' || !isValidDate(value)) {
        return { isValid: false, error: 'Formato de fecha inválido' };
      }
      break;
    case 'EMAIL':
      if (typeof value !== 'string' || !isValidEmail(value)) {
        return { isValid: false, error: 'Email inválido' };
      }
      break;
    case 'CUIT':
      if (typeof value !== 'string' || !isValidCUIT(value)) {
        return { isValid: false, error: 'CUIT inválido' };
      }
      break;
  }

  // Validaciones custom
  if (field.validation) {
    const validation = field.validation as any;

    // Min/Max para números
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return { isValid: false, error: `Debe ser >= ${validation.min}` };
      }
      if (validation.max !== undefined && value > validation.max) {
        return { isValid: false, error: `Debe ser <= ${validation.max}` };
      }
    }

    // Regex
    if (validation.regex && typeof value === 'string') {
      try {
        const regex = new RegExp(validation.regex);
        if (!regex.test(value)) {
          return { isValid: false, error: 'Formato inválido' };
        }
      } catch (error) {
        console.error('Error en regex de validación:', error);
      }
    }

    // Length para strings
    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        return { isValid: false, error: `Mínimo ${validation.minLength} caracteres` };
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return { isValid: false, error: `Máximo ${validation.maxLength} caracteres` };
      }
    }
  }

  // Validar opciones de SELECT
  if (field.fieldType === 'SELECT' && field.options) {
    const options = Array.isArray(field.options) ? field.options : [];
    const isValidOption = options.some((opt: any) =>
      typeof opt === 'string' ? opt === value : opt.value === value
    );

    if (!isValidOption && !field.allowCustom) {
      return { isValid: false, error: 'Opción no válida' };
    }
  }

  return { isValid: true };
}

// Helpers de validación
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidCUIT(cuit: string): boolean {
  const cuitNormalized = cuit.replace(/[^0-9]/g, '');
  return cuitNormalized.length === 11;
}

/**
 * Actualiza estadísticas del template
 */
export async function updateTemplateStats(
  templateId: string,
  success: boolean,
  confidence: number
) {
  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) return;

  const newTimesUsed = template.timesUsed + 1;
  const newSuccessRate =
    (template.successRate * template.timesUsed + (success ? 1 : 0)) / newTimesUsed;
  const newAvgConfidence =
    (template.avgConfidence * template.timesUsed + confidence) / newTimesUsed;

  await prisma.documentTemplate.update({
    where: { id: templateId },
    data: {
      timesUsed: newTimesUsed,
      successRate: newSuccessRate,
      avgConfidence: newAvgConfidence,
    },
  });
}
