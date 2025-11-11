import crypto from 'crypto';

// La clave de encriptación DEBE ser de 32 bytes (256 bits para AES-256)
// Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.warn(
    '⚠️  ENCRYPTION_KEY no está configurada o es inválida. Los tokens NO estarán encriptados.'
  );
}

/**
 * Encripta un texto usando AES-256-CBC
 * @param text Texto a encriptar
 * @returns Texto encriptado en formato "iv:encrypted"
 */
export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    // En desarrollo, retornar sin encriptar (con warning)
    console.warn('⚠️  Retornando texto sin encriptar (ENCRYPTION_KEY no configurada)');
    return text;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Retornar IV + texto encriptado separados por ":"
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error al encriptar:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Desencripta un texto encriptado con encrypt()
 * @param encryptedText Texto en formato "iv:encrypted"
 * @returns Texto desencriptado
 */
export function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    // En desarrollo, retornar sin desencriptar
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error al desencriptar:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Verifica si un texto está encriptado
 * @param text Texto a verificar
 * @returns true si el texto tiene formato de encriptación
 */
export function isEncrypted(text: string): boolean {
  const parts = text.split(':');
  return parts.length === 2 && parts[0].length === IV_LENGTH * 2;
}

/**
 * Encripta un objeto completo (convierte a JSON, encripta, retorna)
 * @param obj Objeto a encriptar
 * @returns Objeto encriptado como string
 */
export function encryptObject<T>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Desencripta y parsea un objeto
 * @param encryptedText Texto encriptado
 * @returns Objeto deserializado
 */
export function decryptObject<T>(encryptedText: string): T {
  const decrypted = decrypt(encryptedText);
  return JSON.parse(decrypted);
}
