// Validadores para datos financieros argentinos

/**
 * Valida un CUIT/CUIL argentino
 */
export function validateCUIT(cuit: string): boolean {
  // Eliminar guiones y espacios
  const cleaned = cuit.replace(/[-\s]/g, '')
  
  // Debe tener 11 dígitos
  if (!/^\d{11}$/.test(cleaned)) {
    return false
  }
  
  // Verificar dígito verificador
  const digits = cleaned.split('').map(Number)
  const verifier = digits.pop()!
  
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = digits.reduce((acc, digit, index) => {
    return acc + digit * multipliers[index]
  }, 0)
  
  const remainder = sum % 11
  const calculatedVerifier = remainder < 2 ? remainder : 11 - remainder
  
  return calculatedVerifier === verifier
}

/**
 * Formatea un CUIT con guiones
 */
export function formatCUIT(cuit: string): string {
  const cleaned = cuit.replace(/[-\s]/g, '')
  if (cleaned.length !== 11) return cuit
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`
}

/**
 * Valida un CAE (Código de Autorización Electrónico)
 */
export function validateCAE(cae: string): boolean {
  // CAE tiene 14 dígitos
  return /^\d{14}$/.test(cae.replace(/[-\s]/g, ''))
}

/**
 * Valida un número de factura en formato punto de venta-número
 */
export function validateInvoiceNumber(invoiceNumber: string): boolean {
  // Formato: 0001-00001234
  return /^\d{4}-\d{8}$/.test(invoiceNumber)
}

/**
 * Valida una fecha en formato YYYY-MM-DD
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Parsea un importe monetario argentino
 */
export function parseAmount(amount: string): number {
  // Remover símbolos de moneda, puntos (separadores de miles) y convertir coma a punto
  const cleaned = amount
    .replace(/[$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Formatea un importe a formato argentino
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount)
}

