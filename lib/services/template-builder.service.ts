import OpenAI from 'openai';
import { env } from '@/lib/config/env';
import { FieldType } from '@prisma/client';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Servicio de construcción de Templates con IA
 *
 * Analiza documentos y sugiere automáticamente:
 * - Qué campos extraer
 * - Tipo de cada campo
 * - Validaciones recomendadas
 * - Prompt personalizado
 */

export interface SuggestedField {
  name: string;
  label: string;
  description: string;
  fieldType: FieldType;
  isRequired: boolean;
  sampleValue: any;
  extractionHint?: string;
  options?: string[];
  validation?: {
    regex?: string;
    min?: number;
    max?: number;
  };
  group?: string;
  confidence: number;
}

export interface TemplateSuggestion {
  suggestedName: string;
  suggestedDescription: string;
  detectedType: string;
  customPrompt: string;
  fields: SuggestedField[];
  detectionRules?: {
    keywords?: string[];
    supplierCuit?: string;
    supplierName?: string;
  };
  validationRules?: Record<string, string>;
}

/**
 * Analiza un documento con OCR y sugiere campos para template
 */
export async function analyzeDocumentAndSuggestFields(
  ocrText: string,
  imageUrl?: string
): Promise<TemplateSuggestion> {
  const analysisPrompt = `
Analiza este documento y sugiere una estructura de template para extraer datos automáticamente.

DOCUMENTO:
${ocrText}

Debes responder en JSON con esta estructura:
{
  "suggestedName": "Nombre descriptivo del template (ej: 'Facturas Edenor', 'Tickets Supermercado')",
  "suggestedDescription": "Breve descripción de qué tipo de documento es",
  "detectedType": "FACTURA | TICKET | SERVICIO | RESUMEN_TARJETA | IMPUESTO | OTRO",
  "customPrompt": "Prompt específico para extraer este tipo de documento",
  "detectionRules": {
    "keywords": ["palabras", "clave", "para", "detectar"],
    "supplierCuit": "CUIT si lo encuentras",
    "supplierName": "Nombre de la empresa emisora"
  },
  "fields": [
    {
      "name": "nombre_tecnico_campo",
      "label": "Etiqueta legible para el usuario",
      "description": "Descripción de qué es este campo",
      "fieldType": "TEXT|NUMBER|DATE|CURRENCY|SELECT|EMAIL|PHONE|CUIT",
      "isRequired": true/false,
      "sampleValue": "valor de ejemplo encontrado en el documento",
      "extractionHint": "Pista de dónde encontrar este dato (ej: 'después de Total:')",
      "options": ["solo", "si", "es", "SELECT"],
      "validation": {
        "regex": "expresión regular si aplica",
        "min": número mínimo si es numérico,
        "max": número máximo si es numérico
      },
      "group": "Emisor|Receptor|Totales|Items|Otros",
      "confidence": 0.0-1.0
    }
  ],
  "validationRules": {
    "total": "subtotal + iva debe ser igual a total",
    "fecha_vencimiento": "debe ser mayor a fecha_emision"
  }
}

IMPORTANTE:
- Detecta TODOS los campos posibles del documento
- Sugiere el tipo correcto para cada campo
- Agrupa campos relacionados (Emisor, Receptor, Totales, etc.)
- Para campos numéricos, usa CURRENCY para montos, NUMBER para cantidades
- Para fechas usa DATE
- Para opciones limitadas usa SELECT con las opciones
- Si encuentras CUIT, usa tipo CUIT
- Calcula confidence basándote en qué tan claro está el campo en el documento
- Genera un customPrompt específico para este tipo de documento

Responde SOLO con el JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Más determinista
    });

    const suggestion = JSON.parse(response.choices[0].message.content || '{}');

    // Validar y normalizar la sugerencia
    return normalizeSuggestion(suggestion);
  } catch (error) {
    console.error('Error analizando documento:', error);
    throw new Error('No se pudo analizar el documento');
  }
}

/**
 * Analiza un documento con Vision (incluye la imagen)
 */
export async function analyzeDocumentWithVision(
  imageUrl: string
): Promise<TemplateSuggestion> {
  const analysisPrompt = `
Analiza esta imagen de documento y sugiere una estructura de template para extraer datos automáticamente.

Debes responder en JSON con esta estructura:
{
  "suggestedName": "Nombre descriptivo del template",
  "suggestedDescription": "Breve descripción",
  "detectedType": "FACTURA | TICKET | SERVICIO | RESUMEN_TARJETA | IMPUESTO | OTRO",
  "customPrompt": "Prompt específico para extraer este tipo de documento",
  "detectionRules": {
    "keywords": ["palabras clave"],
    "supplierCuit": "CUIT si lo encuentras",
    "supplierName": "Nombre empresa"
  },
  "fields": [
    {
      "name": "nombre_campo",
      "label": "Etiqueta",
      "description": "Descripción",
      "fieldType": "TEXT|NUMBER|DATE|CURRENCY|SELECT|CUIT|etc",
      "isRequired": true/false,
      "sampleValue": "valor encontrado",
      "extractionHint": "Pista de ubicación",
      "group": "Emisor|Receptor|Totales|etc",
      "confidence": 0.95
    }
  ],
  "validationRules": {
    "campo": "regla de validación"
  }
}

IMPORTANTE:
- Analiza la imagen completa
- Detecta TODOS los campos visibles
- Sugiere tipos apropiados
- Agrupa campos lógicamente
- Para montos usa CURRENCY
- Para CUIT usa tipo CUIT
- Calcula confidence según claridad

Responde SOLO con el JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const suggestion = JSON.parse(response.choices[0].message.content || '{}');
    return normalizeSuggestion(suggestion);
  } catch (error) {
    console.error('Error analizando documento con Vision:', error);
    throw new Error('No se pudo analizar el documento');
  }
}

/**
 * Mejora un template existente con datos de un nuevo documento
 */
export async function suggestTemplateImprovements(
  existingTemplate: any,
  ocrText: string,
  extractedData: any
): Promise<{
  newFields: SuggestedField[];
  improvedPrompt: string;
  improvedValidations: Record<string, string>;
}> {
  const improvementPrompt = `
Tengo un template existente y acabo de procesar un nuevo documento.

TEMPLATE ACTUAL:
- Nombre: ${existingTemplate.name}
- Campos actuales: ${JSON.stringify(existingTemplate.fields.map((f: any) => f.name))}
- Prompt actual: ${existingTemplate.customPrompt}

NUEVO DOCUMENTO PROCESADO:
${ocrText}

DATOS EXTRAÍDOS:
${JSON.stringify(extractedData, null, 2)}

Sugiere mejoras:
{
  "newFields": [
    // Campos que existen en el documento pero no en el template
    {
      "name": "nombre_campo",
      "label": "Etiqueta",
      "description": "Por qué este campo es útil",
      "fieldType": "tipo",
      "isRequired": false,
      "sampleValue": "valor",
      "confidence": 0.8
    }
  ],
  "improvedPrompt": "Versión mejorada del prompt con más detalles",
  "improvedValidations": {
    "campo": "nueva regla de validación"
  }
}

Responde SOLO con el JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: improvementPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error sugiriendo mejoras:', error);
    throw new Error('No se pudieron sugerir mejoras');
  }
}

/**
 * Normaliza y valida una sugerencia de template
 */
function normalizeSuggestion(suggestion: any): TemplateSuggestion {
  return {
    suggestedName: suggestion.suggestedName || 'Nuevo Template',
    suggestedDescription: suggestion.suggestedDescription || '',
    detectedType: suggestion.detectedType || 'OTRO',
    customPrompt: suggestion.customPrompt || '',
    fields: (suggestion.fields || []).map((field: any, index: number) => ({
      name: field.name || `campo_${index}`,
      label: field.label || field.name || `Campo ${index}`,
      description: field.description || '',
      fieldType: normalizeFieldType(field.fieldType),
      isRequired: field.isRequired || false,
      sampleValue: field.sampleValue,
      extractionHint: field.extractionHint,
      options: field.options,
      validation: field.validation,
      group: field.group || 'General',
      confidence: field.confidence || 0.5,
    })),
    detectionRules: suggestion.detectionRules,
    validationRules: suggestion.validationRules,
  };
}

/**
 * Normaliza tipos de campos a los enums de Prisma
 */
function normalizeFieldType(type: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    TEXT: FieldType.TEXT,
    NUMBER: FieldType.NUMBER,
    DATE: FieldType.DATE,
    DATETIME: FieldType.DATETIME,
    BOOLEAN: FieldType.BOOLEAN,
    SELECT: FieldType.SELECT,
    MULTI_SELECT: FieldType.MULTI_SELECT,
    EMAIL: FieldType.EMAIL,
    PHONE: FieldType.PHONE,
    URL: FieldType.URL,
    CURRENCY: FieldType.CURRENCY,
    PERCENTAGE: FieldType.PERCENTAGE,
    CUIT: FieldType.CUIT,
    JSON: FieldType.JSON,
  };

  return typeMap[type?.toUpperCase()] || FieldType.TEXT;
}

/**
 * Genera un prompt base inteligente para un tipo de documento
 */
export function generateBasePrompt(documentType: string, fields: SuggestedField[]): string {
  const fieldGroups: Record<string, SuggestedField[]> = {};

  // Agrupar campos
  fields.forEach((field) => {
    const group = field.group || 'General';
    if (!fieldGroups[group]) {
      fieldGroups[group] = [];
    }
    fieldGroups[group].push(field);
  });

  let prompt = `Extrae los siguientes datos de este ${documentType.toLowerCase()}:\n\n`;

  // Por cada grupo
  for (const [group, groupFields] of Object.entries(fieldGroups)) {
    if (groupFields.length === 0) continue;

    prompt += `**${group}:**\n`;
    groupFields.forEach((field) => {
      prompt += `- ${field.label}`;
      if (field.isRequired) {
        prompt += ' (REQUERIDO)';
      }
      if (field.description) {
        prompt += `: ${field.description}`;
      }
      if (field.extractionHint) {
        prompt += ` [${field.extractionHint}]`;
      }
      prompt += '\n';
    });
    prompt += '\n';
  }

  prompt += '\nIMPORTANTE:\n';
  prompt += '- Extrae solo los datos que se encuentren claramente visibles\n';
  prompt += '- Si un campo no está presente, usa null\n';
  prompt += '- Mantén los tipos de datos correctos\n';
  prompt += '- Responde en formato JSON estructurado\n';

  return prompt;
}
