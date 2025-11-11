// Tipos para el sistema de extracción

export interface ExtractionResult {
  success: boolean;
  data?: any;
  confidence?: number;
  errors?: string[];
  warnings?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ExtractionMetadata {
  extractionTime: number;
  model: string;
  version: string;
  timestamp: Date;
}

